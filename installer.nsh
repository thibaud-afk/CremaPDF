!macro customInstall
  CreateShortCut "$SMPROGRAMS\Désinstaller CremaPDF.lnk" "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\Désinstaller CremaPDF.lnk"
!macroend
