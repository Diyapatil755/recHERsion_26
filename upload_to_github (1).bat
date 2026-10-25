@echo off
cd /d "%~dp0"
echo Uploading Saheli to GitHub (recHERsion_26)...
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Install it from https://git-scm.com/download/win , then run this file again.
  pause
  exit /b 1
)
if exist ".expo" rmdir /s /q ".expo"
if exist "mobile\.expo" rmdir /s /q "mobile\.expo"
findstr /x /c:".expo/" .gitignore >nul 2>nul || (echo.>> .gitignore & echo .expo/>> .gitignore)
if not exist ".git" git init
git config user.email >nul 2>nul || git config user.email "Diyapatil755@users.noreply.github.com"
git config user.name >nul 2>nul || git config user.name "Diyapatil755"
git add .
git commit -m "Add Saheli web app and Android app"
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/Diyapatil755/recHERsion_26.git
echo.
echo A browser window may ask you to sign in to GitHub. Sign in and allow access.
git push -u origin main --force
echo.
echo Done. Open https://github.com/Diyapatil755/recHERsion_26 and refresh the page.
pause
