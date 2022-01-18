import debug from "debug";
import RoonApi from "node-roon-api";
import RoonApiStatus from "node-roon-api-status";
import RoonApiImage from "node-roon-api-image";
import RoonApiTransport from "node-roon-api-transport";
import slug from "slug";
import fs from 'fs';
import axios from "axios";
import winston from "winston";

const log = debug("server");
const author = "Stef van Hooijdonk";
const progressBarResolution = 100;
const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

// most Roon related code setup from: "https://github.com/docBliny/obs-roon-display.git"

export default class App {
  // ********************************************
  // * Constructors
  // ********************************************
  constructor(config) {
    log("ctor()", config);

    this._config = config;
    this._zones = {};
    this._steelseriesAddress = "";

    this._textIndex = 0;

    this._steelseriesGameID = "SVHROON";
    this._steelseriesGameEventID = "NOWPLAYING";

    this._logger = winston.createLogger({
      levels: logLevels,
      transports: [new winston.transports.Console({ }),
        new winston.transports.File({ filename: "roonsteelseries.log", options: { flags: 'w' }  })],
    });
    
    this._steelseriesAddress = this.findSteelSeriesEngineAddress();
    
    //this.registerSteelseriesGameAndEvent();

    this.checkOrRegistgerSteelseriesRegisteredEvent();

    this._roon = new RoonApi({
      extension_id:        "svh-roon-steelseries",
      display_name:        "Simple Now Playing display intended for Steelseries Oleds",
      display_version:     "1.0.0",
      publisher:           author,
      email:               "stef@personaloffice365.com",
      website:             "https://twitter.com/vanHooijdonk",
      log_level:           "none",

      core_paired: this.corePaired.bind(this),
      core_unpaired: this.coreUnpaired.bind(this),
    });
  }

  // ********************************************
  // * Properties
  // ********************************************
  get config() {
    return this._config;
  }
  get logger() {
    return this._logger;
  }

  get roon() {
    return this._roon;
  }

  get roonCore() {
    return this._roonCore;
  }

  get zones() {
    // Everyone gets their own copy
    return Object.assign({}, this._zones);
  }

  // ********************************************
  // * Public methods
  // ********************************************
  start() {
      // Start Roon
      this.roonApiStatus = new RoonApiStatus(this.roon);

      this.roon.init_services({
        required_services: [ RoonApiTransport, RoonApiImage ],
      });

      this.roonApiStatus.set_status("Extension enabled", false);

      this.roon.start_discovery();
  }

  // ********************************************
  // * Private methods
  // ********************************************
  corePaired(core) {
    this.logger.info("Roon core paired");

    this._roonCore = core;
    const transport = core.services.RoonApiTransport;
    transport.subscribe_zones((response, data) => {
      switch(response) {
      case "Subscribed":
        this.logger.info("Subscribed to Roon");
        this.logger.debug(data);
        this.setZonesFromData(data.zones);
        this.emitAllZones(this.zones);
        break;
      case "Changed":
        if(data.zones_changed) {
          this.logger.info("Roon zones changed.");
          this.setZonesFromData(data.zones_changed);
          this.emitAllZones(this.zones);
        }

        if(data.zones_seek_changed) {
          //this.logger.info("zones_seek_changed", response, JSON.stringify(data));
          this.updateZonesFromSeekData(data.zones_seek_changed);
        }
        break;
      default:
        this.logger.warn(`Unhandled subscription response "${response}"`);
        break;
      }
    });
  }

  coreUnpaired(core) {
    this.logger("Roon core unpaired");
    this._nowPlaying = null;
  }

  /**
   * Sets the zones from Roon data. Creates a unique slugified zone name for each zone.
   * Duplicate display names will get an index appended to the zone name.
   *
   * @param      {Object}  zoneData    The Roon zone data.
   */
  setZonesFromData(zoneData) {
    const zoneNames = [];

    if(Array.isArray(zoneData)) {
      // Loop all zones and create unique internal entries
      zoneData.forEach((zone) => {
        let zoneName = slug(zone.display_name);

        if(Object.prototype.hasOwnProperty.call(zoneNames, zoneName)) {
          zoneNames[zoneName] += 1;
          zoneName = `${zoneName}_${zoneNames[zoneName]}`;
        } else {
          zoneNames[zoneName] = 1;
        }
        zone._zoneName = zoneName;

        // Track by native zone ID. This will keep our unique names consistent while we're running
        this._zones[zone.zone_id] = zone;

      });
    }

    this.logger.debug("Current zones: " + JSON.stringify(this.zones));
  }

  updateZonesFromSeekData(zoneData) {
    // log("seek zone", zone, data.zones_seek_changed);
    if(Array.isArray(zoneData)) {
      zoneData.forEach((seekZone) => {
        const zone = this.zones[seekZone.zone_id];

        if(zone && zone.now_playing) {
          zone.now_playing.seek_position = seekZone.seek_position;
          // only publish to Steelseries if we want this zone to show.
          if(zone._zoneName == this._config.publishZone){
            this.scrollTextToDisplay(this,zone);
          }
        }
      });
    }

  }

  /**
   * Gets the zone by the internal zone name.
   *
   * @param      {<type>}  zoneName  The zone name.
   *
   * @return     {<type>}  The zone by zone name, or null if not found.
   */
  getZoneByZoneName(zoneName) {
    let result = null;

    for(const zoneId of Object.keys(this.zones)) {
      const zone = this.zones[zoneId];
      if(zone._zoneName === zoneName) {
        result = zone;
        break;
      }
    }

    return result;
  }  

  scrollTextToDisplay(ctx, currentZone){    
    var progressBar = 0;
    var artists = "";
    var songtitle = "";
    var album = "";
    
    if(currentZone && currentZone.now_playing){
      // calcuate progress 0<100;
      progressBar = Math.floor(currentZone.now_playing.seek_position / currentZone.now_playing.length * progressBarResolution);
      // read data
      artists = currentZone.now_playing.two_line.line2;
      songtitle = currentZone.now_playing.two_line.line1;
      album = currentZone.now_playing.three_line.line3;

      // scroll song title if too long.
      var scrollingText = songtitle;
      if(scrollingText.length > 16){
        scrollingText = songtitle.substring( ctx._textIndex) + "  | ";
        if(ctx._textIndex > 0) {
          scrollingText += songtitle.substring( 0, ctx._textIndex);
        }        
        ctx._textIndex ++;
        if(ctx._textIndex > songtitle.length){
          ctx._textIndex = 0;
        }
      }

      var nowplayingevent = {
        game: ctx._steelseriesGameID,
        event: ctx._steelseriesGameEventID,
        data: {
          value:progressBar,
          frame:{
            "artists": artists,
            "songtitle": scrollingText,
            "album": album
          }        
        }
      };
      // first few seconds (currentZone.now_playing.seek_position) we shop Now playing
      if(currentZone.now_playing && currentZone.now_playing.seek_position<4){
        nowplayingevent.data.frame.songtitle = currentZone._zoneName + " now playing:";
        nowplayingevent.data.frame.artists = songtitle;
      }

      ctx.sendNowPlayingUpdateToSteelseries(ctx, nowplayingevent);
    }
  }

  emitAllZones(zones) {
  }

  findSteelSeriesEngineAddress(){

    let rawdata = fs.readFileSync('/Library/Application Support/SteelSeries Engine 3/coreProps.json');
    let coreProps = JSON.parse(rawdata);

    this.logger.info("located steelseries gameengine at address:" + coreProps.address);
    return coreProps.address;
  }

  registerSteelseriesGameAndEvent(){

    const roongame = {
      game: this._steelseriesGameID,
      game_display_name: "Roon Display Song",      
      developer: author
    };    

    // remove all.
    axios
      .post(this.getSteelseriesAPIUrl(this,"remove_game"),{game: this._steelseriesGameID})
      .then(res => {
        this.logger.info(`Remove Game in Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        this.logger.error(error)
      });

    axios
      .post(this.getSteelseriesAPIUrl(this,"game_metadata"),roongame)
      .then(res => {
        this.logger.info(`Registered Game in Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        this.logger.error(error)
      });

    const roonnowplaying = {
      game: this._steelseriesGameID,
      event: this._steelseriesGameEventID,
      "icon_id": 23,
      "value_optional": true,
      "min_value": 0,
      "max_value": progressBarResolution,
      handlers: [{
          "device-type": "screened",
          mode: "screen",
          zone: "one",
          datas: [
            {
              lines: [
                      { "has-text": true, "context-frame-key": "songtitle"},
                      { "has-text": true, "context-frame-key": "artists"},
                      { "has-progress-bar": true }
                  ]
            }
          ]}
        ]};      
   
    axios
      .post(this.getSteelseriesAPIUrl(this,"bind_game_event"),roonnowplaying)
      .then(res => {
        this.logger.info(`Registered Now Playing in Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        this.logger.error(error)
      });
  }

  checkOrRegistgerSteelseriesRegisteredEvent(){
    var testevent = {
      game: this._steelseriesGameID,
      event: this._steelseriesGameEventID,
      data: {
        value: 0,
        frame:{
          "artists": "",
          "songtitle": "Loading...."
        }        
      }
    };
    axios
      .post(this.getSteelseriesAPIUrl(this,"game_event"), testevent)
      .then(res => {
        this.logger.info(`Sent Test event to Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        this.logger.error(`Failed to Test event to Steelseries Engine, re-init: statusCode: ${res.status}`)
        this.registerSteelseriesGameAndEvent();
      });    
  }

  sendNowPlayingUpdateToSteelseries(ctx, nowplayingevent){
    // send event to GameSense GG server
    axios
      .post(ctx.getSteelseriesAPIUrl(ctx,"game_event"), nowplayingevent)
      .then(res => {
        //console.log(`Sent event to Steelseries Engine: statusCode: ${res.status}`)
      })
      .catch(error => {
        ctx.logger.error(error)
      });    
  }

  getSteelseriesAPIUrl(ctx, apiendpoint){
    return  'http://' + ctx._steelseriesAddress + "/" + apiendpoint;
  }
}