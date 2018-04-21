import React, { Component } from 'react';
import './App.css';
import MeteoriteLandingsMap from './MeteoriteLandingsMap.js';
import MediaQuery from 'react-responsive';

class App extends Component {
  render() {
    return (
      <div className="App">
        <MediaQuery query="(min-device-width: 1224px)">
          <h1 className="App-title">Meteorite Landings Across the Globe</h1>
          <MeteoriteLandingsMap
            height={1000}
            width={1000}
          />
        </MediaQuery>
        <MediaQuery query="(max-device-width: 1224px)">
          <h1 className="App-title">Meteorite Landings Across the Globe</h1>
          <MeteoriteLandingsMap
            height={320}
            width={320}
          />
        </MediaQuery>
      </div>
    );
  }
}

export default App;
