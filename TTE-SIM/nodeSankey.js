d3.nodeSankey = function() {
    "use strict";

    var nodeSankey = {},
      nodeWidth = 24,
      nodeSpacing = 8,
      linkSpacing = 5,
      arrowheadScaleFactor = 0.5, // Specifies the proportion of a link's stroke width to be allowed for the marker at the end of the link.
      size = [1, 1], // default to one pixel by one pixel
      nodes = [],
      nodeMap = {},
      linkMap = {},
      links = [],
      xScaleFactor = 1,
      yScaleFactor = 1,
      defaultLinkCurvature = 0.5,
      linkWidth = 8
    
    function center(node) {
      return node.y + node.height / 2;
    }



    function initializeNodeArrayProperties(node) {
      node.links = Array(node.port).fill(null); // all ports
      node.linksSide = Array(node.port).fill(-1); // -1 is left and 1 is right
      node.connectedNodes = [];
    }

    function initializeNodeMap() {
      nodes.forEach(function (node) {
        nodeMap[node.id] = node;
        initializeNodeArrayProperties(node);
      });
    }

    function computeNodeLinks() {
      var sourceNode, targetNode, source, target;
      links.forEach(function (link) {
        sourceNode = nodeMap[link.source];
        targetNode = nodeMap[link.target];
        source = link.source + ":" + link.srcport;
        target = link.target + ":" +link.tarport;
        linkMap[source] = target;
        linkMap[target] = source;

        sourceNode.links[link.srcport] = target
        targetNode.links[link.tarport] = source
      });
    }

    function nodeHeight(numPort) {
      var spacing = Math.max(numPort + 1, 0) * linkSpacing,
        scaledSum = numPort * linkWidth * yScaleFactor;
      return scaledSum + spacing;
    }

    function computeNodeValues() {
      nodes.forEach(function (node) {
        node.height = nodeHeight(node.port);
        node.width = nodeWidth;
        node.portPositions = Array(node.port).fill([0, 0]);
        node.linksSide.forEach(function (side, i) {
          var x = side == -1 ? 0 : nodeWidth - linkWidth;
          var y = linkSpacing * (1 + i) + i * linkWidth;
          node.portPositions[i] = [x, y];
        });
      });
    }

    function computeConnectedNodes() {
      var sourceNode, targetNode;
      links.forEach(function (link) {
        sourceNode = nodeMap[link.source];
        targetNode = nodeMap[link.target];
        if (sourceNode.connectedNodes.indexOf(link.target) < 0) {
          sourceNode.connectedNodes.push(link.target);
        }
        if (targetNode.connectedNodes.indexOf(link.source) < 0) {
          targetNode.connectedNodes.push(link.source);
        }
      });
    }

    function computeLeftAndRightLinks() {
      nodes.forEach(function (node) {
        node.linksSide.forEach(function (_, i) {
          var src = node.id + ":" + i,
            tar;
          if (src in linkMap) {
            tar = linkMap[src].split(":")[0];
            if (node.x > nodeMap[tar].x) {
              node.linksSide[i] = -1;
            }
            else {
              node.linksSide[i] = 1;
            }
          }
        });
      });
    }


    //
    nodeSankey.nodeWidth = function (_) {
      if (!arguments.length) { return nodeWidth; }
      nodeWidth = +_;
      return nodeSankey;
    };

    nodeSankey.nodes = function (_) {
      if (!arguments.length) { return nodes; }
      nodes = _;
      return nodeSankey;
    };

    nodeSankey.nodeSpacing = function (_) {
      if (!arguments.length) { return nodeSpacing; }
      nodeSpacing = +_;
      return nodeSankey;
    };

    nodeSankey.links = function (_) {
      if (!arguments.length) { return links; }
      links = _;
      return nodeSankey;
    };

    nodeSankey.linkSpacing = function (_) {
      if (!arguments.length) { return linkSpacing; }
      linkSpacing = +_;
      return nodeSankey;
    };

    nodeSankey.linkWidth = function (_) {
      if (!arguments.length) { return linkWidth; }
      linkWidth = +_;
      return nodeSankey;
    };

    nodeSankey.size = function (_) {
      if (!arguments.length) { return size; }
      size = _;
      return nodeSankey;
    };

    nodeSankey.initializeNodes = function () {
      initializeNodeMap();
      computeNodeLinks();
      computeNodeValues();
      computeConnectedNodes();
      return nodeSankey;
    };

    nodeSankey.layout = function () {
      nodes.filter(function (node) { return node.type == "ACS"; })
        .forEach(function (node, index) { node.x = 500; node.y = index * (node.height + 8); });
      
      nodes.filter(function (node) { return node.type == "GPM"; })
        .forEach(function (node, index) { node.x = 200; node.y = index * (node.height + 8); });

      computeLeftAndRightLinks();
      computeNodeValues();
    };

    nodeSankey.relayout = function () {
      computeLeftAndRightLinks();
      computeNodeValues();
    };

    nodeSankey.link = function () {
      var curvature = defaultLinkCurvature;

      function leftToRightLink(link) {
        var arrowHeadLength = link.thickness * arrowheadScaleFactor,
            straightSectionLength = (3 * link.thickness / 4) - arrowHeadLength,
            sourceY = link.source.portPositions[link.srcport][1] + linkWidth / 4,
            targetY = link.target.portPositions[link.tarport][1] + linkWidth / 4,
            x0 = link.source.x + link.source.width,
            x1 = x0 + arrowHeadLength / 2,
            x4 = link.target.x - straightSectionLength - arrowHeadLength,
            xi = d3.interpolateNumber(x0, x4),
            x2 = xi(curvature),
            x3 = xi(1 - curvature),
            y0 = link.source.y + sourceY + link.thickness / 2,
            y1 = link.target.y + targetY + link.thickness / 2;
        return "M" + x0 + "," + y0
             + "L" + x1 + "," + y0
             + "C" + x2 + "," + y0
             + " " + x3 + "," + y1
             + " " + x4 + "," + y1
             + "L" + (x4 + straightSectionLength) + "," + y1;
      }
  
      function rightToLeftLink(link) {
        var arrowHeadLength = link.thickness * arrowheadScaleFactor,
            straightSectionLength = link.thickness / 4,
            sourceY = link.source.portPositions[link.srcport][1] + linkWidth / 4,
            targetY = link.target.portPositions[link.tarport][1] + linkWidth / 4,
            x0 = link.source.x,
            x1 = x0 - arrowHeadLength / 2,
            x4 = link.target.x + link.target.width + straightSectionLength + arrowHeadLength,
            xi = d3.interpolateNumber(x0, x4),
            x2 = xi(curvature),
            x3 = xi(1 - curvature),
            y0 = link.source.y + sourceY + link.thickness / 2,
            y1 = link.target.y + targetY + link.thickness / 2;
        return "M" + x0 + "," + y0
             + "L" + x1 + "," + y0
             + "C" + x2 + "," + y0
             + " " + x3 + "," + y1
             + " " + x4 + "," + y1
             + "L" + (x4 - straightSectionLength) + "," + y1;
      }

      function link(d) {
        var sourceNode = nodeMap[d.source],
          targetNode = nodeMap[d.target],
          link = {
            source: sourceNode,
            target: targetNode,
            srcport: d.srcport,
            tarport: d.tarport,
            thickness: d.thickness
          }
        if (sourceNode.x < targetNode.x) {
          return leftToRightLink(link);
        }
        else {
          return rightToLeftLink(link);
        }
      }

      link.curvature = function (_) {
        if (!arguments.length) { return curvature; }
        curvature = +_;
        return link;
      }

      return link;

    };

    return nodeSankey;
};