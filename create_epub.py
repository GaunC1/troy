#!/usr/bin/env python3
"""
Create EPUB from Troy Book 1 markdown chapters.

Requirements:
    pip install ebooklib markdown

Usage:
    python create_epub.py
"""

import os
import re
from pathlib import Path

from ebooklib import epub
import markdown


def get_chapter_files(book_dir: Path) -> list[Path]:
    """Get chapter files in order."""
    files = list(book_dir.glob("troy_book1_chapter*.md"))

    # Extract chapter number and sort
    def chapter_num(f: Path) -> int:
        match = re.search(r'chapter(\d+)', f.name)
        return int(match.group(1)) if match else 0

    return sorted(files, key=chapter_num)


def extract_chapter_title(content: str) -> str:
    """Extract chapter title from markdown content."""
    # Look for "# Chapter X: Title" pattern
    match = re.search(r'^#\s*Chapter\s+\w+:\s*(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()

    # Fallback: look for any h1
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()

    return "Untitled Chapter"


def markdown_to_html(md_content: str) -> str:
    """Convert markdown to HTML."""
    # Convert markdown to HTML
    html = markdown.markdown(md_content, extensions=['extra'])
    return html


def create_epub(output_path: Path):
    """Create EPUB from Book 1 chapters."""
    book_dir = Path(__file__).parent / "troy_book1"

    # Initialize EPUB
    book = epub.EpubBook()

    # Set metadata
    book.set_identifier('troy-book1-gathering-storm')
    book.set_title('The Fall of Troy: Book One - The Gathering Storm')
    book.set_language('en')
    book.add_author('Anonymous')  # Update with actual author

    # Add CSS
    style = '''
    body {
        font-family: Georgia, serif;
        line-height: 1.6;
        margin: 5%;
    }
    h1 {
        text-align: center;
        margin-top: 2em;
        margin-bottom: 1em;
    }
    h2 {
        text-align: center;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
    }
    hr {
        border: none;
        border-top: 1px solid #999;
        margin: 2em auto;
        width: 30%;
    }
    p {
        text-indent: 1.5em;
        margin: 0.5em 0;
    }
    blockquote {
        font-style: italic;
        margin: 1em 2em;
    }
    '''
    css = epub.EpubItem(
        uid="style",
        file_name="style/main.css",
        media_type="text/css",
        content=style
    )
    book.add_item(css)

    # Create title page
    title_page = epub.EpubHtml(title='Title Page', file_name='title.xhtml')
    title_page.content = '''
    <html>
    <head><link rel="stylesheet" href="style/main.css" type="text/css"/></head>
    <body>
        <h1>THE FALL OF TROY</h1>
        <h2>Book One: The Gathering Storm</h2>
    </body>
    </html>
    '''
    title_page.add_item(css)
    book.add_item(title_page)

    # Process chapters
    chapters = []
    chapter_files = get_chapter_files(book_dir)

    for i, chapter_file in enumerate(chapter_files, 1):
        print(f"Processing: {chapter_file.name}")

        content = chapter_file.read_text(encoding='utf-8')
        title = extract_chapter_title(content)

        # Convert to HTML
        html_content = markdown_to_html(content)

        # Create chapter
        chapter = epub.EpubHtml(
            title=f"Chapter {i}: {title}",
            file_name=f'chapter_{i}.xhtml',
            lang='en'
        )
        chapter.content = f'''
        <html>
        <head><link rel="stylesheet" href="style/main.css" type="text/css"/></head>
        <body>
        {html_content}
        </body>
        </html>
        '''
        chapter.add_item(css)

        book.add_item(chapter)
        chapters.append(chapter)

    # Define Table of Contents
    book.toc = [title_page] + chapters

    # Add navigation files
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    # Define spine (reading order)
    book.spine = ['nav', title_page] + chapters

    # Write EPUB
    epub.write_epub(str(output_path), book, {})
    print(f"\nCreated: {output_path}")


if __name__ == '__main__':
    output = Path(__file__).parent / "troy_book1.epub"
    create_epub(output)
