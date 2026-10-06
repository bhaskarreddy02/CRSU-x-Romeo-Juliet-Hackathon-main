import markdown
from pathlib import Path
import subprocess

def convert():
    md_path = Path('RESEARCH_NOTE.md')
    pdf_path = Path('RESEARCH_NOTE.pdf').resolve()
    html_path = Path('RESEARCH_NOTE.html').resolve()
    
    md_text = md_path.read_text(encoding='utf-8')
    
    html_body = markdown.markdown(md_text, extensions=['tables', 'fenced_code', 'toc', 'nl2br'])
    
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Approach Note: Global Reciprocal Matching with Value-of-Information Clarification</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  @page {{
    size: A4;
    margin: 18mm 16mm;
  }}

  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #1e293b;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
  }}

  h1 {{
    font-size: 19pt;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 2.5px solid #2563eb;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }}

  h2 {{
    font-size: 13pt;
    font-weight: 600;
    color: #1e3a8a;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
    margin-top: 20px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }}

  h3 {{
    font-size: 11pt;
    font-weight: 600;
    color: #334155;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }}

  p {{
    margin-top: 0;
    margin-bottom: 8px;
    text-align: justify;
  }}

  hr {{
    border: none;
    height: 1px;
    background: #cbd5e1;
    margin: 14px 0;
  }}

  blockquote {{
    margin: 10px 0;
    padding: 10px 16px;
    background-color: #f0fdf4;
    border-left: 4px solid #16a34a;
    border-radius: 4px;
    color: #166534;
    font-size: 10pt;
    page-break-inside: avoid;
  }}

  blockquote p {{
    margin: 0;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8.5pt;
    page-break-inside: avoid;
  }}

  th {{
    background-color: #1e293b;
    color: #ffffff;
    font-weight: 600;
    text-align: left;
    padding: 6px 8px;
    border: 1px solid #1e293b;
    letter-spacing: 0.02em;
  }}

  td {{
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }}

  tr:nth-child(even) td {{
    background-color: #f8fafc;
  }}

  pre {{
    background-color: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 8pt;
    line-height: 1.4;
    color: #0f172a;
    overflow-x: auto;
    page-break-inside: avoid;
    margin: 10px 0;
  }}

  code {{
    font-family: 'JetBrains Mono', Consolas, monospace;
    font-size: 8.5pt;
    background-color: #f1f5f9;
    color: #0369a1;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #e2e8f0;
  }}

  pre code {{
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }}

  ul, ol {{
    margin-top: 4px;
    margin-bottom: 8px;
    padding-left: 20px;
  }}

  li {{
    margin-bottom: 3px;
  }}

  strong {{
    font-weight: 600;
    color: #0f172a;
  }}
</style>
</head>
<body>
{html_body}
</body>
</html>
"""
    html_path.write_text(html_doc, encoding='utf-8')
    print(f"Generated HTML at {html_path}")
    
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    cmd = [
        edge_path,
        '--headless=new',
        '--disable-gpu',
        f'--print-to-pdf={pdf_path}',
        '--no-pdf-header-footer',
        html_path.as_uri()
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and pdf_path.exists():
        print(f"Successfully generated PDF: {pdf_path} ({pdf_path.stat().st_size} bytes)")
        return True
    else:
        print(f"Failed to generate PDF: {res.stderr}")
        return False

if __name__ == '__main__':
    convert()
