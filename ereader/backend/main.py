import asyncio
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Set

import frontmatter
import markdown
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

# Configuration
BOOK_DIR = Path(__file__).parent.parent.parent / "troy_book1"

# Markdown processor
md = markdown.Markdown(extensions=['extra', 'smarty', 'toc'])


def add_drop_caps(html: str) -> str:
    """Add drop-cap class to first paragraph and paragraphs after section breaks."""
    # Add drop-cap to first <p> tag
    first_p_replaced = False
    result = []
    lines = html.split('\n')
    prev_was_hr = False

    for line in lines:
        if not first_p_replaced and line.strip().startswith('<p>'):
            line = line.replace('<p>', '<p class="drop-cap">', 1)
            first_p_replaced = True
        elif prev_was_hr and line.strip().startswith('<p>'):
            line = line.replace('<p>', '<p class="drop-cap">', 1)
            prev_was_hr = False

        prev_was_hr = '<hr' in line.lower()
        result.append(line)

    return '\n'.join(result)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        self.active_connections -= disconnected


manager = ConnectionManager()


def parse_chapter_file(filepath: Path) -> dict:
    """Parse a markdown chapter file and return structured content."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Try to parse frontmatter
        try:
            post = frontmatter.loads(content)
            metadata = dict(post.metadata)
            body = post.content
        except Exception:
            metadata = {}
            body = content

        # Extract title from first H1 or H2
        title_match = re.search(r'^#+ (.+)$', body, re.MULTILINE)
        title = title_match.group(1) if title_match else filepath.stem

        # Convert markdown to HTML
        md.reset()
        html_content = md.convert(body)

        # Add drop-cap class to first paragraph and paragraphs after hr
        html_content = add_drop_caps(html_content)

        return {
            "id": filepath.stem,
            "filename": filepath.name,
            "title": title,
            "metadata": metadata,
            "content": html_content,
            "raw": body,
        }
    except Exception as e:
        return {
            "id": filepath.stem,
            "filename": filepath.name,
            "title": filepath.stem,
            "error": str(e),
            "content": f"<p>Error loading chapter: {e}</p>",
            "raw": "",
        }


def get_all_chapters() -> list:
    """Get all chapter files sorted by name."""
    chapters = []
    if BOOK_DIR.exists():
        files = sorted(BOOK_DIR.glob("*.md"))
        for filepath in files:
            # Skip non-chapter files
            if "chapter" in filepath.stem.lower():
                chapter = parse_chapter_file(filepath)
                chapters.append(chapter)
    return chapters


def get_chapter_by_id(chapter_id: str) -> dict | None:
    """Get a specific chapter by its ID."""
    if BOOK_DIR.exists():
        for filepath in BOOK_DIR.glob("*.md"):
            if filepath.stem == chapter_id:
                return parse_chapter_file(filepath)
    return None


# File watcher
class ChapterFileHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        self._debounce_tasks: Dict[str, asyncio.Task] = {}

    def _schedule_update(self, filepath: str):
        """Debounced update broadcast."""
        async def delayed_broadcast():
            await asyncio.sleep(0.5)  # Debounce 500ms
            path = Path(filepath)
            if path.exists() and path.suffix == '.md':
                chapter = parse_chapter_file(path)
                await manager.broadcast({
                    "type": "chapter_updated",
                    "chapter": chapter,
                })
                print(f"Broadcast update for: {path.name}")

        # Cancel previous task for this file
        if filepath in self._debounce_tasks:
            self._debounce_tasks[filepath].cancel()

        # Schedule new task
        task = self.loop.create_task(delayed_broadcast())
        self._debounce_tasks[filepath] = task

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            self.loop.call_soon_threadsafe(
                lambda: self._schedule_update(event.src_path)
            )

    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.md'):
            self.loop.call_soon_threadsafe(
                lambda: self._schedule_update(event.src_path)
            )


# Lifespan handler
observer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global observer
    loop = asyncio.get_event_loop()
    event_handler = ChapterFileHandler(loop)
    observer = Observer()

    if BOOK_DIR.exists():
        observer.schedule(event_handler, str(BOOK_DIR), recursive=False)
        observer.start()
        print(f"Watching for changes in: {BOOK_DIR}")
    else:
        print(f"Warning: Book directory not found: {BOOK_DIR}")

    yield

    if observer:
        observer.stop()
        observer.join()


# Create app
app = FastAPI(title="Troy eReader API", lifespan=lifespan)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Routes
@app.get("/")
async def root():
    return {"message": "Troy eReader API", "status": "running"}


@app.get("/api/chapters")
async def list_chapters():
    """List all available chapters with metadata."""
    chapters = get_all_chapters()
    return JSONResponse({
        "chapters": [
            {
                "id": ch["id"],
                "title": ch["title"],
                "filename": ch["filename"],
            }
            for ch in chapters
        ]
    })


@app.get("/api/chapters/{chapter_id}")
async def get_chapter(chapter_id: str):
    """Get a specific chapter's full content."""
    chapter = get_chapter_by_id(chapter_id)
    if chapter:
        return JSONResponse(chapter)
    return JSONResponse({"error": "Chapter not found"}, status_code=404)


@app.get("/api/book")
async def get_full_book():
    """Get all chapters for the book."""
    chapters = get_all_chapters()
    return JSONResponse({
        "title": "The Fall of Troy",
        "subtitle": "Book One: The Gathering Storm",
        "chapters": chapters,
    })


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial data
        chapters = get_all_chapters()
        await websocket.send_json({
            "type": "init",
            "chapters": chapters,
        })

        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                # Handle any client messages if needed
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                break
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
