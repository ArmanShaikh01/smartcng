@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Smart CNG Station — Dev Server
REM
REM  This script MUST be used instead of "npm run dev" because Vite 7 cannot
REM  handle the '#' character in the project path (D:\C#\smart cng station).
REM  A Windows Junction at D:\SmartCNG points to the same project folder.
REM  Running Vite from D:\SmartCNG avoids the '#' issue entirely.
REM ─────────────────────────────────────────────────────────────────────────────
cd /d D:\SmartCNG
npm run dev
