Remove-Item *.syso -ErrorAction SilentlyContinue
go-winres make --arch amd64 --in winres\winres.json
go build -ldflags="-H windowsgui" -o StyledMD.exe