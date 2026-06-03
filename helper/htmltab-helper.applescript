-- HTML tab Helper.app
-- 处理 htmltab:// URL scheme
-- macOS 通过 GetURL Apple Event 把链接传进来

on open location theURL
	set logFile to "/tmp/htmltab-helper.log"
	do shell script "echo '[' $(date '+%Y-%m-%d %H:%M:%S') '] called: " & quoted form of theURL & "' >> " & quoted form of logFile

	-- 去掉 htmltab:// 前缀
	set urlBody to text 11 thru -1 of theURL  -- "htmltab://" 长度 10

	-- 拆 action 和 path
	set slashPos to my findChar(urlBody, "/")
	if slashPos = 0 then
		do shell script "echo '  ERR: no slash' >> " & quoted form of logFile
		return
	end if

	set theAction to text 1 thru (slashPos - 1) of urlBody
	set thePath to text (slashPos + 1) thru -1 of urlBody

	-- URL decode + 加上 / 前缀
	set decodedPath to do shell script "python3 -c \"import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]))\" " & quoted form of thePath
	if decodedPath does not start with "/" then
		set decodedPath to "/" & decodedPath
	end if

	do shell script "echo '  action=" & theAction & " path=" & decodedPath & "' >> " & quoted form of logFile

	-- 直接用 shell 命令 open，比 Finder Apple Event 稳定
	if theAction = "reveal" then
		try
			do shell script "open -R " & quoted form of decodedPath
			do shell script "echo '  → reveal OK' >> " & quoted form of logFile
		on error errMsg number errNum
			do shell script "echo '  → reveal FAIL: " & errNum & " " & errMsg & "' >> " & quoted form of logFile
			-- 退路：打开父目录
			set parentDir to do shell script "dirname " & quoted form of decodedPath
			try
				do shell script "open " & quoted form of parentDir
			end try
		end try
	else if theAction = "open" then
		try
			do shell script "open " & quoted form of decodedPath
			do shell script "echo '  → open OK' >> " & quoted form of logFile
		on error errMsg
			do shell script "echo '  → open FAIL: " & errMsg & "' >> " & quoted form of logFile
		end try
	else if theAction = "trash" then
		-- 把文件移到废纸篓（可恢复）
		try
			tell application "Finder"
				delete POSIX file decodedPath
			end tell
			do shell script "echo '  → trash OK' >> " & quoted form of logFile
		on error errMsg number errNum
			do shell script "echo '  → trash FAIL: " & errNum & " " & errMsg & "' >> " & quoted form of logFile
		end try
	end if
end open location

-- 找第一个字符位置
on findChar(theStr, theChar)
	repeat with i from 1 to length of theStr
		if character i of theStr = theChar then return i
	end repeat
	return 0
end findChar

on run
	-- 静默启动，不弹通知
end run
