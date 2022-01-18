Experiment to have a Roon zone publish now playing song info to my Steelseries keyboard OLED screen using a Steelseries Gamesense App.

Most Roon related code setup from: https://github.com/docBliny/obs-roon-display.git



** Install as a Service on Mac OSX **

If node is installed via homebrew first make sure node is available at /usr/local/bin/node:
```shell
sudo ln -s /opt/homebrew/bin/node /usr/local/bin/node
```

then from the source directory copy the plist file
```shell
sudo cp ./personaloffice365.com.RoonSteelseries.plist /Library/LaunchDaemons  
```

then enable the background service:
```shell
sudo launchctl load /Library/LaunchDaemons/personaloffice365.com.RoonSteelseries.plist 
```

then start the service:
```shell
sudo launchctl start personaloffice365.com.RoonSteelseries      
```
