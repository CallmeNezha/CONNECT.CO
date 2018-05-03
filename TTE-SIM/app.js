var svg, tooltip, isTransitioning, colorScale, simulateStart;

var OPACITY = {
    NODE_DEFAULT: 0.9,
    NODE_FADED: 0.1,
    NODE_HIGHLIGHT: 0.8,
    LINK_DEFAULT: 0.6,
    LINK_FADED: 0.05,
    LINK_HIGHLIGHT: 0.9
  },
  FLOW_COLOR = "#2E86D1",
  OUTER_MARGIN = 10,
  TRANSITION_DURATION = 400,
  MARGIN = {
    TOP: OUTER_MARGIN,
    RIGHT: OUTER_MARGIN,
    BOTTOM: OUTER_MARGIN,
    LEFT: OUTER_MARGIN
  },
  HEIGHT = 960 - MARGIN.TOP - MARGIN.BOTTOM,
  WIDTH = 1266 - MARGIN.LEFT - MARGIN.RIGHT,
  LINK_COLOR = "#b3b3b3",
  TYPES = ["PORT", "ACS", "GPM"],
  TYPE_COLORS = ["#d3d3d3", "#1b9e77", "#d95f02"];

colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS);


var nodes = [
  { "type": "ACS", "id": 1, "name": "ACS1", "port": 24 },
  { "type": "ACS", "id": 2, "name": "ACS2", "port": 24 },
  { "type": "GPM", "id": 3, "name": "GPM1", "port": 2 },
  { "type": "GPM", "id": 4, "name": "GPM2", "port": 2 },
  { "type": "GPM", "id": 5, "name": "GPM3", "port": 2 },
  { "type": "GPM", "id": 6, "name": "GPM4", "port": 2 },
  { "type": "GPM", "id": 7, "name": "GPM5", "port": 2 },
  { "type": "GPM", "id": 8, "name": "GPM6", "port": 2 },
  { "type": "GPM", "id": 9, "name": "GPM7", "port": 2 },
]

var links = [
  { "source": 1, "srcport": 1, "target": 3, "tarport": 1, "thickness": 3},
  { "source": 1, "srcport": 3, "target": 2, "tarport": 1, "thickness": 3},
  { "source": 1, "srcport": 4, "target": 2, "tarport": 2, "thickness": 3},
  { "source": 2, "srcport": 3, "target": 5, "tarport": 1, "thickness": 3},
  { "source": 2, "srcport": 4, "target": 6, "tarport": 1, "thickness": 3},
  { "source": 7, "srcport": 0, "target": 2, "tarport": 14, "thickness": 3},
  { "source": 5, "srcport": 0, "target": 1, "tarport": 13, "thickness": 3},
]

// Used when temporarily disabling user interractions to allow animations to complete
var disableUserInterractions = function (time) {
    isTransitioning = true;
    setTimeout(function () {
      isTransitioning = false;
    }, time);
  },
  showTooltip = function (text) {
    tooltip
      .style("left", d3.event.pageX + "px")
      .style("top", d3.event.pageY + 15 + "px")
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", 1);
    tooltip.select(".value").text(text);
  },
  hideTooltip = function () {
    tooltip
      .transition()
      .duration(TRANSITION_DURATION)
        .style("opacity", 0);
  },
  /**
  * Returns a random number between min (inclusive) and max (exclusive)
  */
  getRandomArbitrary = function (min, max) {
    return Math.random() * (max - min) + min;
  },

  /**
  * Returns a random integer between min (inclusive) and max (inclusive)
  * Using Math.round() will give you a non-uniform distribution!
  */
  getRandomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }




svg = d3.select("#chart").append("svg")
  .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
  .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
  .append("g")
  .attr("transform", "translate(" + MARGIN.LEFT + "," + MARGIN.TOP + ")");
svg.append("g").attr("id", "links");
svg.append("g").attr("id", "nodes");

tooltip = d3.select("#chart").append("div").attr("id", "tooltip");
tooltip.style("opacity", 0)
  .append("p")
    .attr("class", "value");

defs = svg.append("defs");

defs.append("marker")
  .style("fill", LINK_COLOR)
  .attr("id", "arrowHead")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");




function update() {
  var link, node, ports, port;

  function drawNodes(data) {
    node = svg.select("#nodes").selectAll(".node")
      .data(nodeSankey.nodes(), function (d) { return d.id; });

    node.select("rect")
      .style("fill", function (d) {
        return colorScale(d.type);
      })
      .style("stroke", function (d) {
        return d3.rgb(colorScale(d.type)).darker(0.1);
      })
      .style("opacity", OPACITY.NODE_DEFAULT)
      .style("stroke-width", "1px")
      .attr("height", function (d) { return d.height; })
      .attr("width", nodeSankey.nodeWidth());
    node.select(".ports").selectAll("rect")
      .data(function (d) { return d.portPositions; })
      .style("stroke", function (d) { return colorScale("port"); })
      .style("stroke-width", "1px")
      .style("fill", function (d) { return d3.rgb(colorScale("port")).darker(0.9); })
      .attr("transform", function (d) { return "translate(" + d[0] + "," + d[1] + ")" })
      .attr("height", nodeSankey.linkWidth())
      .attr("width", nodeSankey.linkWidth());

    node.select(".ports").selectAll("text")
      .data(function (d) { return d.portPositions; })
      .text(function (d, i) { return i })
      .attr("x", function (d) { return d[0]; })
      .attr("y", function (d) { return d[1]; })
      .attr("dx", "0.5em")
      .attr("dy", "0.8em")
      .attr("text-anchor", "middle")
      .attr("transform", null)
  }

  function drawLinks(data) {
    link = svg.select("#links").selectAll("path.link")
      .data(nodeSankey.links());
    
    link.style("stroke-width", function (d) { return Math.max(1, d.thickness); })
      .attr("d", path)
      .style("stoke", LINK_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);
  }

  function dragmove(node) {
    if (isTransitioning) return;
    node.x = Math.max(0, Math.min(WIDTH - node.width, d3.event.x));
    node.y = Math.max(0, Math.min(HEIGHT - node.height, d3.event.y));
    d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    nodeSankey.relayout();
    drawNodes();
    link.data(nodeSankey.links())
      .attr("d", path);
  }

  function restoreLinksAndNodes() {
    node
      .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_DEFAULT);
    link.style("stroke", LINK_COLOR)
      .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.LINK_DEFAULT);
  }

  function highlightConnected(g) {

    link.filter(function (d) { return d.source == g.id || d.target == g.id; })
      .style("stroke", FLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);

  }

  simulateStart = function () {
    isTransitioning = true;
    var forward = false
      , BOUNCE_DURATION = 2500;
    function repeat() {
      forward = !forward;
      link
        .style("stroke", FLOW_COLOR)
        .style("opacity", OPACITY.LINK_DEFAULT)
        .attr("stroke-dasharray", "5 3")
        .attr("stroke-dashoffset", forward ? 0 : BOUNCE_DURATION)
        .transition()
          .ease("linear")
          .duration(BOUNCE_DURATION)
          .attr("stroke-dashoffset", forward ? BOUNCE_DURATION : 0)
        .each("end", repeat);
    }
    repeat();
      
  };

  simulateEnd = function () {
    isTransitioning = false;
    link
      .transition()
      .style("stroke", LINK_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT)
      .attr("stroke-dasharray", null)
      .attr("stroke-dashoffset", null);
  };

  function fadeUnconnected(g) {
    link.filter(function (d) { return d.source != g.id && d.target != g.id; })
      .transition()
      .style("stroke", LINK_COLOR)
      .style("opacity", OPACITY.LINK_FADED);
    node.filter(function (d) { return d.id == g.id ? false : !g.connectedNodes.includes(d.id); })
      .transition()
      .style("opacity", OPACITY.NODE_FADED);
  }


  node = svg.select("#nodes").selectAll(".node")
    .data(nodeSankey.nodes(), function (d) { return d.id; });




  nodeEnter = node.enter().append("g").attr("class", "node");
  nodeEnter
    .attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    })
    .style("opacity", 1e-6)
    .transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });



  nodeEnter.append("rect")
    .style("fill", function (d) {
      return colorScale(d.type);
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type)).darker(0.1);
    })
    .style("stroke-width", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", nodeSankey.nodeWidth());

    // allow nodes to be dragged to new positions
    nodeEnter.call(d3.behavior.drag()
      .origin(function (d) { return d; })
      .on("drag", dragmove));

  nodeEnter.append("text")
    // .data(function (d) { return d; })
    .text(function (d, i) { return d.name; })
    .attr("x", function (d) { return d.width / 2; })
    .attr("y", "0.0em")
    .attr("dx", "0.0em")
    .attr("dy", "-0.3em")
    .attr("text-anchor", "middle")
    .attr("transform", null);

  nodeEnter.on("mouseenter", function (g) {
    if (!isTransitioning) {
      restoreLinksAndNodes();
      highlightConnected(g);
      fadeUnconnected(g);
      showTooltip("ID:" + g.id + " - NAME:" + g.name);
    }
  });

  nodeEnter.on("mouseleave", function () {
    if (!isTransitioning) {
      hideTooltip();
      restoreLinksAndNodes();
    }
  });

  ports = nodeEnter.append("g").attr("class", "ports");
  port = ports.selectAll(".port").data(function (d) {
    return d.portPositions;
  });
  node.exit().remove();

  port.enter().append("rect");
  port.enter().append("text");

  drawNodes(nodeSankey.nodes());

  link = svg.select("#links").selectAll("path.link")
    .data(nodeSankey.links());



  linkEnter = link.enter().append("path")
    .attr("class", "link")
    .style("fill", "none");

  linkEnter.transition()
    .duration(TRANSITION_DURATION)
    .style("stroke-width", function (d) { return Math.max(1, d.thickness); })
    .attr("d", path)
    .style("opacity", OPACITY.LINK_DEFAULT);
  
  linkEnter.style("stroke", LINK_COLOR)
    .style("opacity", 0)
    .transition()
      .delay(TRANSITION_DURATION)
      .duration(TRANSITION_DURATION)
      .attr("d", path)
      .style("stroke-width", function (d) { return Math.max(1, d.thickness); })
      .style("opacity", OPACITY.LINK_DEFAULT);

  link.exit().remove();


  
  

  
}

nodeSankey = d3.nodeSankey();

nodeSankey
  .nodeWidth(36)
  .nodeSpacing(10)
  .linkSpacing(4)
  .size([WIDTH, HEIGHT]);

nodeSankey
  .nodes(nodes)
  .links(links)
  .initializeNodes()
  .layout();

path = nodeSankey.link().curvature(0.45);

disableUserInterractions(2 * TRANSITION_DURATION);

update();

var toggleSimulate = (function () {
  return function () {
    if (d3.select("#btnSimulate").select("input").property("checked")) {
      simulateStart();
      // console.log(d3.select("#btnSimulate").select("input").property("checked"));
    } 
    else {
      simulateEnd();
      // console.log(d3.select("#btnSimulate").select("input").property("checked"));
    }
  };
})();

d3.select("#btnSimulate")
  .attr("onChange", "toggleSimulate()");
