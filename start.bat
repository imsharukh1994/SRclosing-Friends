@echo off
title SR Closure Manager - Gemini
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
echo.
echo Starting SR Closure Manager...
npm start
pause
