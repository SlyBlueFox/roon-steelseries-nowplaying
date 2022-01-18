## Roon Now Playing

## Introduction
Experiment to have a Roon zone publish now playing song info to my Steelseries keyboard OLED screen using a Steelseries Gamesense App.
SPecial thanks to __docBliny__ and his work on the Roon / App part: https://github.com/docBliny/obs-roon-display.git

### How it looks on my Apex PRO TKL
<img src="https://user-images.githubusercontent.com/17196910/149915870-f27a1b4f-24db-44b8-ac61-328960c2c630.jpg" alt="steelseries-apex-pro-tkl" title="steelseries-apex-pro-tkl" width="350"/>

### Run the code

I have this working with:
- Node v17.3.1 (installed via homebrew)
- Roon v1.8 (build 884) running on ROCK
- Steelseries GG for MacOSX 12.2 
- Mac OSX Montery 12.1

Download the code in this Repo (with a git clone)
```shell
git clone git@github.com:stefvanhooijdonk/roon-steelseries-nowplaying.git
```
In the index.js, change the Roon zone you want to subscribe the now-playing too:
```js
const config = {
  publishZone: "Library"
};
```
Then run the npm install command to get all the dependencies in place:
```shell
npm install
```
And run the server from the command line:
```shell
node .
```

If all is well, this node App should now show up in your Roon Extentions. Go and enable it there. Once that is done, and you start playing songs via Roon in your zone you should see the song title scrolling, the artists and a progress bar for the song play duration.
There is a log file roonsteelseries.log in the folder to check.

### Install as a Service on Mac OSX

You will need to *install* this app on the machine that has the Steelseries keyboard/mouse connected that have an OLED screen.

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
