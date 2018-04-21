import React, { Component } from 'react';
import * as d3 from "d3";
import * as topojson from "topojson"
import versor from 'versor'
import './App.css';

class MeteoriteLandingsMap extends Component {
  componentDidMount() {
    this.makeGraph();
  }

  makeGraph = async () => {
    // We need to fetch the data async for best speed before drawing the map
    const geoPromise = fetch("https://unpkg.com/world-atlas@1/world/110m.json")
      .then(status)
      .then(json)
      .then(data => data);
    const meteoritePromise = fetch("https://raw.githubusercontent.com/FreeCodeCamp/ProjectReferenceData/master/meteorite-strike-data.json")
      .then(status)
      .then(json)
      .then(data => data);
    const [geoData, meteoriteData] = await Promise.all([geoPromise, meteoritePromise]);
    this.drawMap(geoData, meteoriteData)

    // response status
    function status(response) {
      if (response.status >= 200 && response.status < 300) {
        return Promise.resolve(response);
      } else {
        return Promise.reject(new Error(response.statusText));
      }
    };

    // json response
    function json(response) {
      return response.json();
    };
  }
  // map function
  drawMap = (world, meteoriteData) => {
    const defaultRadius = 0.75, container = document.createElement("container");
    let v0, r0, q0, onScreenNodes, zoomLevel = 1, highlightedMeteorite = null;

    const dataContainer = d3.select(container);

    const canvas = d3.select(this.refs.map)
      .append("canvas")
      .attr('height', this.props.height)
      .attr('width', this.props.width);
    const width = canvas.property("width"),
      height = canvas.property("height"),
      context = canvas.node().getContext("2d"),
      projection = d3.geoOrthographic()
        .scale((height - 10) / 2)
        .translate([width / 2, height / 2])
        .precision(0.1);
    const originalScale = projection.scale(),
      path = d3.geoPath()
        .projection(projection)
        .context(context);

    canvas.call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged));
    // Create containers to store each meteorite
    function buildMeteorites() {
      const massBounds = d3.extent(meteoriteData.features, (d) => {
        return parseInt(d.properties.mass, 10)
      });
      const radius = d3.scalePow()
        .exponent(0.5)
        .domain(massBounds)
        .range([defaultRadius, defaultRadius * 50]);
      dataContainer.selectAll('container.meteorite-point')
        .data(meteoriteData.features, (d) => {
          return d.properties.id
        })
        .enter()
        .append('container')
        .classed('meteorite-point', true)
        .attr('meteorite-lon', (d) => {
          return d.geometry == null ? "null" : d.geometry.coordinates[0]
        })
        .attr('meteorite-lat', (d) => {
          return d.geometry == null ? "null" : d.geometry.coordinates[1]
        })
        .attr('meteorite-mass', (d) => {
          return d.properties.mass
        })
        .attr('meteorite-mass-radius', (d) => {
          return radius(parseInt(d.properties.mass, 10))
        })
        .attr('meteorite-class', (d) => {
          return d.properties.recclass
        })
        .attr('meteorite-year', (d) => {
          return d.properties.year
        })
        .attr('meteorite-location', (d) => {
          return d.properties.name
        });
      d3.selectAll('canvas').call(d3.drag().on('start', dragstarted).on('drag', dragged));
      d3.select('canvas').on('mousemove', moveMouse);
      d3.selectAll('canvas').call(d3.zoom().scaleExtent([0.5, 20]).on('zoom', zoomed));
      getVisibleMeteorites();
      draw();
    }
    // handle zoom
    function zoomed() {
      zoomLevel = d3.event.transform.k;
      projection.scale(originalScale * d3.event.transform.k);
      updateTooltip(true);
      getVisibleMeteorites();
      draw()
    }
    // find which meteorites are visible on the screen
    function getVisibleMeteorites() {
      onScreenNodes = [];
      const meteorites = dataContainer.selectAll('container.meteorite-point');
      meteorites.each(function (d) {
        const meteorite = d3.select(this),
          point = {
            type: "Point",
            coordinates: [meteorite.attr('meteorite-lon'), meteorite.attr('meteorite-lat')]
          },
          bounds = path.bounds(point),
          canvasR = parseFloat(meteorite.attr('meteorite-mass-radius')) * zoomLevel,
          canvasX = bounds[0][0],
          canvasY = bounds[0][1];
        meteorite.attr('meteorite-canvas-x', canvasX);
        meteorite.attr('meteorite-canvas-y', canvasY);
        meteorite.attr('meteorite-canvas-r', canvasR);
        if (canvasX >= 0 && canvasX <= width && canvasY >= 0 && canvasY <= height) {
          onScreenNodes.push(meteorite);
        }
      });
    }
    // actually paint the meteorites to the canvas
    function drawMeteorites() {
      context.fillStyle = "rgba(204, 2, 116, .5)"
      onScreenNodes.forEach((meteorite) => {
        const lon = meteorite.attr('meteorite-lon'),
          lat = meteorite.attr('meteorite-lat'),
          radius = meteorite.attr('meteorite-mass-radius');
        path.pointRadius(radius * zoomLevel);
        context.beginPath();
        path({
          type: "Point",
          coordinates: [lon, lat]
        });
        context.fill();
      });
      if (highlightedMeteorite == null) {
        return;
      }
      context.fillStyle = "rgba(242, 211, 14, .6)";
      path.pointRadius(highlightedMeteorite.attr('meteorite-mass-radius') * zoomLevel);
      context.beginPath();
      path({
        type: "Point",
        coordinates: [highlightedMeteorite.attr('meteorite-lon'), highlightedMeteorite.attr('meteorite-lat')]
      });
      context.fill();
    }
    // when the mouse is moved, check for meteorite hover positions for tooltips
    function moveMouse() {
      const relativeCoords = d3.mouse(this);
      let hoveredMeteorite = [];
      onScreenNodes.forEach((node) => {
        const cx = parseInt(node.attr('meteorite-canvas-x'), 10),
          cy = parseInt(node.attr('meteorite-canvas-y'), 10),
          r = parseFloat(node.attr('meteorite-canvas-r'), 10),
          x = relativeCoords[0],
          y = relativeCoords[1];
        if (Math.pow((x - cx), 2) + Math.pow((y - cy), 2) < Math.pow(r, 2)) {
          hoveredMeteorite.push(node);
        }
      });
      if (hoveredMeteorite.length > 1) {
        let smallestMeteorite = null;
        hoveredMeteorite.forEach((node) => {
          if (smallestMeteorite == null || parseInt(node.attr('meteorite-mass'), 10) < parseInt(smallestMeteorite.attr('meteorite-mass'), 10)) {
            smallestMeteorite = node;
          }
        });
        highlightedMeteorite = smallestMeteorite;
        updateTooltip();
      }
      else if (hoveredMeteorite.length === 1) {
        highlightedMeteorite = hoveredMeteorite[0];
        updateTooltip();
      }
      else if (hoveredMeteorite.length === 0) {
        highlightedMeteorite = null;
        updateTooltip();
      }
      draw();
    }
    function updateTooltip(hide) {
      if (hide === void 0) { hide = false; }
      if (highlightedMeteorite == null || hide) {
        d3.select('.tooltip')
          .classed('visible', false)
          .classed('hidden', true);
        return;
      }
      let htmlString = "";
      htmlString += '<p>Location: ' + highlightedMeteorite.attr('meteorite-location') + '</p>';
      htmlString += '<p>Year: ' + highlightedMeteorite.attr('meteorite-year').split('-')[0];
      htmlString += '<p>Mass: ' + d3.format(',')((parseInt(highlightedMeteorite.attr('meteorite-mass'), 10) / 1000)) + ' kg</p>';
      htmlString += '<p>Class: ' + highlightedMeteorite.attr('meteorite-class');
      d3.select('.tooltip')
        .classed('hidden', false)
        .classed('visible', true)
        .style('left', d3.event.pageX < width / 2 ? (d3.event.pageX + 15) + "px" : (d3.event.pageX - 165) + "px")
        .style('top', d3.event.pageY + "px")
        .html(htmlString);
    }
    function dragstarted() {
      v0 = versor.cartesian(projection.invert(d3.mouse(this)));
      r0 = projection.rotate();
      q0 = versor(r0);
      updateTooltip(true)
    }

    function dragged() {
      const v1 = versor.cartesian(projection.rotate(r0).invert(d3.mouse(this))),
        q1 = versor.multiply(q0, versor.delta(v0, v1)),
        r1 = versor.rotation(q1);
      projection.rotate(r1);
      draw();
    }
    const sphere = { type: "Sphere" },
      land = topojson.feature(world, world.objects.land);

    function draw() {
      context.clearRect(0, 0, width, height)
      context.beginPath()
      path(sphere)
      context.fillStyle = "#1a50cc"
      context.fill()
      context.beginPath()
      path(land)
      context.fillStyle = "#4dc21d"
      context.fill()
      getVisibleMeteorites()
      drawMeteorites()
    }
    buildMeteorites();
  }

  render() {
    return (
      <div className="map">
        <div ref="map"></div>
        <div className="tooltip hidden" />
      </div>
    )
  }
}

export default MeteoriteLandingsMap;