var svg, tooltip, isTransitioning, colorScale,
  nodes, links,
  simulateStart, simulateEnd, activateLinks, activatedLinksSet
  

var OPACITY = {
    NODE_DEFAULT: 0.9,
    NODE_FADED: 0.1,
    NODE_HIGHLIGHT: 0.8,
    LINK_DEFAULT: 0.6,
    LINK_FADED: 0.05,
    LINK_HIGHLIGHT: 0.9
  },
  IN_FLOW_COLOR = "#d95f02",
  OUT_FLOW_COLOR = "#1b9e77",
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
  TYPES = ["PORT", "ACS", "NODE"],
  TYPE_COLORS = ["#d3d3d3", "#1b9e77", "#d95f02"];


function scatter(range, operation) {
  var array;
  range = range.sort((a, b) => a - b);
  array = new Array(range.length-1);
  range.forEach(function (arr, i) {
    array[i] = operation(range[i], range[i+1]);
  });
  return array;
}

function gather(array2d, step) {
  var i,
    length = Math.ceil(array2d.length / step);
    array = new Array(length);
  for (i=0; i<length; ++i) {
    if (i == length - 1 && array2d.length % step != 0) { // last one and not evenly sliced
      array[i] = d3.merge(array2d.slice(i*step, i*step + array2d.length % step))
      break;
    }
    array[i] = d3.merge(array2d.slice(i*step, i*step+step));
  }
  return array;
}

function topoStrParse(topoStr) {
  var topo = topoStr.split(',')
    , nodes = []
    , links = []
    , i = 0
    , id = 0
    , switches = new Set()
    , swJoints
  
  // fetch switches node and rename with id
  topo.forEach( (_, i) => {
    var switchId;
    if (topo[i].indexOf("#") == 0 && topo[i] != "#*" && !switches.has(topo[i+1])) {
      switchId = topo[i+1];
      id = Math.max(id, switchId);
      switches.add(switchId);
      nodes.push({ "type": "ACS", "id": switchId, "name": "ACS" + switchId, "port": 24 });
      topo[i+1] = switchId.toString();
    }
  });
  // fetch node
  topo.forEach( (_, i) => {
    if (topo[i].indexOf("#") == 0 && topo[i] != "#*") {
      ++id;
      nodes.push( { "type": "NODE", "id": id, "name": topo[i].substring(1), "port":1, "charater": topo[i+3] });
      links.push( { "id":id+":"+0+"-"+Number(topo[i+1])+":"+Number(topo[i+2]), "source":id, "srcport":0, "target":Number(topo[i+1]), "tarport":Number(topo[i+2]), "thickness":2 } );
    }
  });
  //
  swJoints = topo.slice(topo.findIndex(elem => elem == "#*"));
  links.push(
    { "id":nodes[0].id+":"+swJoints[1]+"-"+nodes[1].id+":"+swJoints[3], 
    "source":nodes[0].id, 
    "srcport":Number(swJoints[1]),
    "target":nodes[1].id, 
    "tarport":Number(swJoints[3]), 
    "thickness":2 
    });

  links.forEach( (val) => {
    links.push({
      "id": val.target+":"+val.tarport+"-"+val.source+":"+val.srcport,
      "source": val.target,
      "srcport": val.tarport,
      "target": val.source,
      "tarport": val.srcport,
      "thickness": val.thickness
    })
  });

  return [nodes, links]
}

function linkScheduleStrParse(scheduleStr, duration, sampling) {
  /**
   * timeQueue 2D-Array index = [ 
   *  [receive_time, cpu_id, switch_id&&port_id&&direction, message_id, message_size], 
   *  [...], 
   *   ... 
   *  ]
   *  array length == duration * sampling
   */

  var schedule = scheduleStr.split("\n")
    .filter((e) => e.length != 0 && e[0] != "#")
    .map((el) => el.split(',').map((_el) => Number(_el)));

  schedule = schedule.map((el) => {
    var switchId = Math.floor(el[2] / 1000),
      switchPort = Math.floor((el[2] % 1000) / 10),
      direction = el[2] % 10 == 2 ? 1 : -1; // 1 means switch sent message, -1 vice versa

    return { "time": el[0],
      "cpu": el[1],
      "switch": switchId,
      "port": switchPort,
      "direction": direction,
      "messageId": el[3],
      "size": el[4]
    }
  });
  
  var i, tick, ticks_, timeQueue;

  schedule.sort((a, b) => a.time - b.time);
  timeScale = d3.scale.linear()
    .domain([0, duration * sampling])
    .range([schedule[0].time, schedule[schedule.length - 1].time]);

  ticks_ = d3.range(duration * sampling).map((i) => timeScale(i));

  i = 0;
  timeQueue = scatter(ticks_, (a, b) => {
    var time,
      elems = []
    for (; i<schedule.length; ++i) {
      time = schedule[i].time;
      if (time >= a && time < b) {
        elems.push(i);
      } else {
        break;
      }
    }
    return elems;
  });
  return [schedule, timeQueue];
}


function linkDelayStrParse(delayStr, duration, sampling) {
  var delay = delayStr.split("\n")
    .filter((e) => e.length != 0 && e[0] != "#")
    .map((el) => el.split(',').map((_el) => Number(_el)));

  delay = delay.map((el) => {
    return {
      "time": el[0],
      "messageId": el[1],
      "delay": el[2]
    } });
  
  delay.sort((a, b) => a.time - b.time);
  
  
}


colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS);
[nodes, links] = topoStrParse(input.topo_str);




// Used when temporarily disabling user interractions to allow animations to complete
var showTooltip = function (text) {
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

    link.filter(function (d) { return d.source == g.id; })
      .style("stroke", IN_FLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);

    link.filter(function (d) { return d.target == g.id; })
      .style("stroke", OUT_FLOW_COLOR)
      .style("opacity", OPACITY.LINK_DEFAULT);

  }

  simulateStart = function() {
    isTransitioning = true;
    /**
     * @param inPorts - set() contains "{switchId}:{port}"
     * @param outPorts - set() contains "{switchId}:{port}"
     */
    activatedLinksSet = new Set();

    activateLinks = function (inPorts, outPorts, active_duration, stiffness) {
      link.filter((d) => {
          var srcport, dstport;
          [srcport, dstport] = d.id.split('-');
          if (activatedLinksSet.has(srcport) || activatedLinksSet.has(dstport)) {
            return false;
          } else if (outPorts.has(srcport)) {
            d.direction = 1;
            activatedLinksSet.add(srcport);
            return true;
          } else if (inPorts.has(dstport)) {
            d.direction = -1;
            activatedLinksSet.add(dstport);
            return true;
          } else {
            return false;
          }
        })
        .style("stroke", (d) => d.direction == 1 ? OUT_FLOW_COLOR : IN_FLOW_COLOR)
        .attr("stroke-dasharray", "5 3")
        .attr("stroke-dashoffset", stiffness)
        .transition()
          .ease("linear")
          .duration(active_duration)
          .attr("stroke-dashoffset", 0)
        .transition()
          .duration(0)
          .style("stroke", LINK_COLOR)
          .style("opacity", OPACITY.LINK_DEFAULT)
          .attr("stroke-dasharray", null)
          .attr("stroke-dashoffset", null)
        .each("end", (d) => {
          var srcport, dstport;
          [srcport, dstport] = d.id.split('-');
          activatedLinksSet.delete(srcport);
          activatedLinksSet.delete(dstport);
        });
    };  
  };

  simulateEnd = function() {
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
    .attr("id", function(d) { return d.id; })
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

update();

