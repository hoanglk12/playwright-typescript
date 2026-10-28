@echo off
cd /d "%~dp0.."
echo Starting LightRAG server...
echo Vault: memory-vault/20-memory
echo Server: http://localhost:9621
echo Swagger: http://localhost:9621/docs
echo.
echo Press Ctrl+C to stop.
echo.

REM --- Load .lightrag.env by setting each variable ---
REM    (lightrag-server reads .env from cwd; we SET vars instead
REM     so the project-root .env files for Node are not affected)
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".lightrag.env") do (
    if not "%%A"=="" if not "%%B"=="" set "%%A=%%B"
)

REM --- lightrag-server >=1.5.3 prints a Unicode banner that crashes on the
REM     default Windows console codepage (cp1252) unless forced to UTF-8 ---
set PYTHONIOENCODING=utf-8

REM --- Wrapper masks the LLM/embedding endpoint hostnames in console + lightrag.log ---
call .lightrag-venv\Scripts\activate
python scripts\lightrag-server-masked.py ^
    --host 127.0.0.1 ^
    --port 9621 ^
    --working-dir .lightrag ^
    --input-dir memory-vault/20-memory ^
    --llm-binding openai ^
    --embedding-binding openai
