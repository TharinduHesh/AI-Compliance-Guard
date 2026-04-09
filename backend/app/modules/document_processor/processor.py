"""
Module 1: Document Processing Engine
Handles PDF/DOCX extraction, text cleaning, segmentation, and integrity validation
"""

import hashlib
import os
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import re
import logging

import PyPDF2
from docx import Document

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Document Processing Engine for compliance documents
    Supports PDF and DOCX formats with integrity validation
    """
    
    def __init__(self):
        self.supported_formats = ['.pdf', '.docx']
        
    def validate_document(self, file_path: str) -> Tuple[bool, str, str]:
        """
        Validate document format and calculate hash
        
        Args:
            file_path: Path to document file
            
        Returns:
            Tuple of (is_valid, file_hash, error_message)
        """
        try:
            path = Path(file_path)
            
            # Check if file exists
            if not path.exists():
                return False, "", "File does not exist"
            
            # Check file extension
            if path.suffix.lower() not in self.supported_formats:
                return False, "", f"Unsupported format. Supported: {', '.join(self.supported_formats)}"
            
            # Calculate SHA-256 hash for integrity
            file_hash = self._calculate_hash(file_path)
            
            logger.info(f"Document validated: {path.name} (Hash: {file_hash[:16]}...)")
            return True, file_hash, ""
            
        except Exception as e:
            logger.error(f"Document validation error: {str(e)}")
            return False, "", str(e)
    
    def extract_text(self, file_path: str) -> Dict[str, any]:
        """
        Extract text from PDF or DOCX document
        
        Args:
            file_path: Path to document file
            
        Returns:
            Dictionary containing extracted text and metadata
        """
        path = Path(file_path)
        extension = path.suffix.lower()
        
        try:
            if extension == '.pdf':
                return self._extract_pdf(file_path)
            elif extension == '.docx':
                return self._extract_docx(file_path)
            else:
                raise ValueError(f"Unsupported file format: {extension}")
                
        except Exception as e:
            logger.error(f"Text extraction error: {str(e)}")
            raise
    
    def _extract_pdf(self, file_path: str) -> Dict[str, any]:
        """Extract text from PDF document"""
        text_content = []
        metadata = {}
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            # Extract metadata
            metadata = {
                'num_pages': len(pdf_reader.pages),
                'file_name': Path(file_path).name,
                'file_type': 'PDF',
                'extracted_at': datetime.utcnow().isoformat()
            }
            
            # Extract text from each page
            for page_num, page in enumerate(pdf_reader.pages, start=1):
                text = page.extract_text()
                if text.strip():
                    text_content.append({
                        'page': page_num,
                        'text': text.strip()
                    })
        
        full_text = '\n\n'.join([page['text'] for page in text_content])
        
        return {
            'full_text': full_text,
            'pages': text_content,
            'metadata': metadata,
            'word_count': len(full_text.split()),
            'char_count': len(full_text)
        }
    
    def _extract_docx(self, file_path: str) -> Dict[str, any]:
        """Extract text from DOCX document, including tables and headers."""
        doc = Document(file_path)
        
        paragraphs = []
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append(para.text.strip())
        
        # Also extract text from tables (common in compliance docs)
        table_texts = []
        for table in doc.tables:
            for row in table.rows:
                row_text = ' | '.join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text.strip():
                    table_texts.append(row_text)
        
        full_text = '\n\n'.join(paragraphs)
        if table_texts:
            full_text += '\n\n--- Tables ---\n' + '\n'.join(table_texts)
        
        metadata = {
            'num_paragraphs': len(paragraphs),
            'num_tables': len(doc.tables),
            'file_name': Path(file_path).name,
            'file_type': 'DOCX',
            'extracted_at': datetime.utcnow().isoformat()
        }
        
        return {
            'full_text': full_text,
            'paragraphs': paragraphs,
            'metadata': metadata,
            'word_count': len(full_text.split()),
            'char_count': len(full_text)
        }
    
    def clean_text(self, text: str) -> str:
        """
        Clean extracted text
        - Remove extra whitespace
        - Normalize line breaks
        - Remove special characters (optional)
        
        Args:
            text: Raw extracted text
            
        Returns:
            Cleaned text
        """
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # Remove multiple spaces (but NOT newlines)
        text = re.sub(r'[^\S\n]+', ' ', text)
        
        # Collapse 3+ consecutive newlines into 2
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove leading/trailing whitespace per line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        # Remove leading/trailing whitespace overall
        text = text.strip()
        
        return text
    
    def segment_document(self, text: str) -> List[Dict[str, str]]:
        """
        Segment document into logical sections
        Based on common section headers in compliance documents
        
        Args:
            text: Full document text
            
        Returns:
            List of sections with headers and content
        """
        # Common section patterns in compliance documents
        section_patterns = [
            r'^\s*\d+(?:\.\d+){0,3}\.?\s+[A-Z][^\n]*$',
            r'(?i)^\s*(purpose|scope|policy|procedure|responsibility|responsibilities|definitions|references|context|leadership|planning|support|operation|performance|improvement)\b[^\n]*$',
        ]
        
        sections = []
        current_section = {'header': 'Introduction', 'content': ''}
        
        lines = text.split('\n')
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                current_section['content'] += '\n'
                continue

            is_header = False
            
            # Check if line matches section pattern
            for pattern in section_patterns:
                if re.match(pattern, stripped):
                    # Save previous section
                    if current_section['content'].strip():
                        sections.append(current_section)
                    
                    # Start new section
                    current_section = {
                        'header': stripped,
                        'content': ''
                    }
                    is_header = True
                    break

            # Heuristic uppercase heading detection (short title-like lines only)
            if not is_header and self._is_probable_uppercase_header(stripped):
                if current_section['content'].strip():
                    sections.append(current_section)
                current_section = {
                    'header': stripped,
                    'content': ''
                }
                is_header = True
            
            if not is_header:
                current_section['content'] += stripped + '\n'
        
        # Add last section
        if current_section['content'].strip():
            sections.append(current_section)
        
        return sections
    
    def extract_clauses(self, sections: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """
        Extract individual clauses from sections
        
        Args:
            sections: List of document sections
            
        Returns:
            List of individual clauses
        """
        clauses = []
        seen = set()
        
        for section in sections:
            content = section['content']
            
            # Split by common clause delimiters:
            # bullet points, numbered lists, sentences, or paragraph breaks
            clause_texts = re.split(
                r'\n\s*[-•]\s+|\n\s*\d+(?:\.\d+)*[.)]\s+|(?<=[.!?;:])\s+(?=[A-Z])|\n{2,}',
                content
            )
            
            for clause_text in clause_texts:
                clause_text = clause_text.strip()
                clause_text = re.sub(r'\s+', ' ', clause_text)
                clause_text = re.sub(r'^\s*(page\s+\d+\s+of\s+\d+|\d+)\s*$', '', clause_text, flags=re.IGNORECASE)
                
                # Only include meaningful clauses (min length + token count)
                if len(clause_text) > 35 and len(clause_text.split()) >= 6:
                    fingerprint = clause_text.lower()
                    if fingerprint in seen:
                        continue
                    seen.add(fingerprint)
                    clauses.append({
                        'section': section['header'],
                        'text': clause_text,
                        'length': len(clause_text)
                    })
        
        return clauses
    
    def _calculate_hash(self, file_path: str) -> str:
        """Calculate SHA-256 hash of file"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            # Read file in chunks for memory efficiency
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return sha256_hash.hexdigest()
    
    def process_document(self, file_path: str) -> Dict[str, any]:
        """
        Complete document processing pipeline
        
        Args:
            file_path: Path to document
            
        Returns:
            Processed document data with all components
        """
        # Validate document
        is_valid, file_hash, error = self.validate_document(file_path)
        if not is_valid:
            raise ValueError(f"Document validation failed: {error}")
        
        # Extract text
        extracted_data = self.extract_text(file_path)
        
        # Clean text
        cleaned_text = self.clean_text(extracted_data['full_text'])
        
        # Segment document
        sections = self.segment_document(cleaned_text)
        
        # Extract clauses
        clauses = self.extract_clauses(sections)
        
        # Fallback: if no clauses found, split by sentences
        if len(clauses) < 8 and cleaned_text.strip():
            logger.info("Low clause count from section parser — augmenting with sentence split")
            sentences = re.split(r'(?<=[.!?])\s+', cleaned_text)
            for i, s in enumerate(sentences):
                s = s.strip()
                s = re.sub(r'\s+', ' ', s)
                if len(s) > 50 and len(s.split()) >= 8:
                    clauses.append({'section': f'Paragraph {i+1}', 'text': s, 'length': len(s)})
            if not sections:
                sections = [{'header': 'Document Content', 'content': cleaned_text}]

        # Final dedupe pass while preserving order
        unique_clauses = []
        seen_text = set()
        for c in clauses:
            key = c.get('text', '').strip().lower()
            if not key or key in seen_text:
                continue
            seen_text.add(key)
            unique_clauses.append(c)

        clauses = unique_clauses
        
        logger.info(f"Document processed: {len(sections)} sections, {len(clauses)} clauses")
        
        return {
            'file_hash': file_hash,
            'metadata': extracted_data['metadata'],
            'full_text': cleaned_text,
            'word_count': extracted_data['word_count'],
            'char_count': extracted_data['char_count'],
            'sections': sections,
            'clauses': clauses,
            'processed_at': datetime.utcnow().isoformat()
        }

    def _is_probable_uppercase_header(self, line: str) -> bool:
        """Detect true uppercase headings while avoiding normal sentence lines."""
        if not line or len(line) > 90:
            return False

        # Must contain alphabetic characters.
        letters = [ch for ch in line if ch.isalpha()]
        if len(letters) < 4:
            return False

        upper_ratio = sum(1 for ch in letters if ch.isupper()) / len(letters)
        if upper_ratio < 0.8:
            return False

        # Avoid lines that look like full sentences.
        if line.endswith('.'):
            return False

        return True


# Singleton instance
document_processor = DocumentProcessor()
