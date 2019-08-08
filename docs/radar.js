// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
const parseDate = d3.timeParse("%Y-%m-%d");

var durationColorScheme = d3.scaleLinear().domain([0, 6, 24])
    .range(["#afa", "yellow","red"]);

const durationColor = (d1, d2) => {
  return durationColorScheme((d2-d1) / (30*3600*24*1000));
};


const contrastedTextColor = bgcolor => {
  let bg_r, bg_g, bg_b;
  if (bgcolor.match(/^#[0-9a-f]{6}/)) {
    const bg_rgb = parseInt('0x' + bgcolor.slice(1));
    bg_r = (bg_rgb >> 16) & 0xff;
    bg_g = (bg_rgb >>  8) & 0xff;
    bg_b = (bg_rgb >>  0) & 0xff;
  } else if (bgcolor.match(/^rgb\(/)) {
    [bg_r, bg_g, bg_b] = bgcolor.split(',').map(x => parseInt(x.replace(/[^0-9]/g, ''), 10));
  } else {
    console.error("could not parse color " + bgcolor);
  }
  luma = 0.2126 * bg_r + 0.7152 * bg_g + 0.0722 * bg_b ;// ITU-R BT.709
  if (luma < 128)
    return 'ffffff';
  else
    return '000000';
}


function radar_visualization(config) {

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var seed = 42;
  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // radial_min / radial_max are multiples of PI
  const quadrants = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }
  ];

  const rings = [
    { radius: 130 },
    { radius: 200 },
    { radius: 270 },
    { radius: 340 },
    { radius: 410 },
    { radius: 480 }
  ];

  const title_offset =
    { x: -675, y: -600 };

  const footer_offset =
    { x: -675, y: 600 };

  const legend_offset = [
    { x: 450, y: 90 },
    { x: -675, y: 90 },
    { x: -675, y: -310 },
    { x: 450, y: -310 }
  ];

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }

  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y)
    }
  }

  function segment(quadrant, ring) {
    var polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring === 0 ? 30 : rings[ring - 1].radius
    };
    var polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    var cartesian_min = {
      x: 15 * quadrants[quadrant].factor_x,
      y: 15 * quadrants[quadrant].factor_y
    };
    var cartesian_max = {
      x: rings[3].radius * quadrants[quadrant].factor_x,
      y: rings[3].radius * quadrants[quadrant].factor_y
    };
    return {
      clipx: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.x = cartesian(p).x; // adjust data too!
        return d.x;
      },
      clipy: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.y = cartesian(p).y; // adjust data too!
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        });
      }
    }
  }

  // position each entry randomly in its segment
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    var point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color= entry.lastActiveAt ? durationColor(parseDate(entry.lastActiveAt.slice(0,10)), new Date()) : "grey";
  }

  // partition entries according to segments
  var segmented = new Array(quadrants.length);
  for (var quadrant = 0; quadrant < quadrants.length; quadrant++) {
    segmented[quadrant] = new Array(rings.length);
    for (var ring = 0; ring < rings.length; ring++) {
      segmented[quadrant][ring] = [];
    }
  }
  for (var i=0; i<config.entries.length; i++) {
    var entry = config.entries[i];
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  var id = 1;
  for (var quadrant of [2,3,1,0]) {
    for (var ring = 0; ring < rings.length; ring++) {
      var entries = segmented[quadrant][ring];
      entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
      for (var i=0; i<entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 580) - 600,
      Math.max(0, quadrants[quadrant].factor_y * 580) - 600,
      620,
      620
    ].join(" ");
  }
  var svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", config.width)
    .attr("height", config.height);

  var radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.height / 2));
  }

  var grid = radar.append("g");

  // draw grid lines
  grid.append("line")
    .attr("x1", 0).attr("y1", -580)
    .attr("x2", 0).attr("y2", 580)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);
  grid.append("line")
    .attr("x1", -580).attr("y1", 0)
    .attr("x2", 580).attr("y2", 0)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  var defs = grid.append("defs");
  var filter = defs.append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
  filter.append("feFlood")
    .attr("flood-color", "rgb(0, 0, 0, 0.8)");
  filter.append("feComposite")
    .attr("in", "SourceGraphic");

  // draw rings
  for (var i = 0; i < rings.length; i++) {
  }

 function legend_transform(quadrant, ring, index=null) {
    var dx = ring < 2 ? 0 : (ring < 4 ? 120 : 240);
    var dy = (index == null ? -16 : index * 12);
    if (ring % 2 === 1) {
      dy = dy + 36 + segmented[quadrant][ring-1].length * 12;
    }
    return translate(
      legend_offset[quadrant].x + dx,
      legend_offset[quadrant].y + dy
    );
  }

  // draw title and legend (only in print layout)
  if (true || config.print_layout) {

    // title
    radar.append("text")
      .attr("transform", translate(title_offset.x, title_offset.y))
      .text(config.title)
      .attr("aria-role", "heading")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "34px");

    // footer
    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("▲ moved up     ▼ moved down")
      .attr("xml:space", "preserve")
      .style("font-family", "Arial, Helvetica")
      .style("font-size", "10px");

    // legend
    var legend = radar.append("g");
    for (var quadrant = 0; quadrant < quadrants.length; quadrant++) {
      if (config.print_layout) {
      for (var ring = 0; ring < rings.length; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring))
          .text(config.rings[ring].name)
          .style("font-family", "Arial, Helvetica")
          .style("font-size", "12px")
          .style("font-weight", "bold");
        legend.selectAll(".legend" + quadrant + ring)
          .data(segmented[quadrant][ring])
          .enter()
            .append("text")
              .attr("transform", function(d, i) { return legend_transform(quadrant, ring, i); })
              .attr("class", "legend" + quadrant + ring)
              .attr("id", function(d, i) { return "legendItem" + d.id; })
              .text(function(d, i) { return d.id + ". " + d.label; })
              .style("font-family", "Arial, Helvetica")
              .style("font-size", "11px")
              .on("mouseover", showBubble)
              .on("mouseout", hideBubble);
      }
      }
    }
  }

  // layer for entries
  var rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  var bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none");
  bubble.append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", "#333");
  bubble.append("text")
    .attr("id", "bubbletext")
    .style("font-family", "sans-serif")
    .style("font-size", "10px")
    .style("fill", "#fff");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#333");

  function showBubble(d) {
    if (true || d.active || config.print_layout) {
      d3.select(this)
        .attr("aria-labelledby", "bubbletext")
        .attr("aria-controls", "desc bubbletext");
      var tooltip = d3.select("#bubble text")
        .text(d.label);
      var bbox = tooltip.node().getBBox();
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
        .style("opacity", 0.8);
      d3.select("#bubble rect")
        .attr("x", -5)
        .attr("y", -bbox.height)
        .attr("width", bbox.width + 10)
        .attr("height", bbox.height + 4);
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 - 5, 3));
    }
    showDescription.call(this,d);
    highlightLegendItem(d);
  }

  function hideBubble(d) {
    d3.select(this).attr("aria-labelledby", null)
      .attr("aria-controls", null);
    var bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
        .style("opacity", 0);
    hideDescription.call(this, d);
    unhighlightLegendItem(d);
  }

  function showDescription(d) {
    const desc = document.getElementById("desc");
    d3.select(this).attr("aria-describedby", "desc");
    desc.className = "show";
    desc.querySelector("a").href = d.link;
    desc.querySelector("a").textContent = d.label;
    desc.querySelector(".desc").innerHTML = d.body;
    desc.querySelector(".status").textContent = "In " + config.rings[d.ring].name + (d.lastMovedAt ? " since " + d.lastMovedAt.slice(0,10) : "");
    desc.querySelector(".comments").textContent = "Received " + d.comments.length + " comments" + (d.comments.length ? ", last one on " + d.comments[d.comments.length - 1].slice(0, 10) : "");
    desc.querySelector(".labels").innerHTML = "";
    desc.querySelector(".labels").appendChild(document.createTextNode("Labels: "));
    d.labels.forEach(l => {
      const span = document.createElement("span");
      span.style.backgroundColor = "#" + l.color;
      span.style.color = contrastedTextColor("#" + l.color);
      span.textContent = l.name;
      desc.querySelector(".labels").appendChild(span);
      desc.querySelector(".labels").appendChild(document.createTextNode(" "));
    });
  }

  function hideDescription(d) {
    d3.select(this).attr("aria-describedby", null);
    desc.className = "hide";
  }

  function highlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    if (!legendItem) return;
    legendItem.setAttribute("filter", "url(#solid)");
    legendItem.setAttribute("fill", "white");
  }

  function unhighlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    if (!legendItem) return;
    legendItem.removeAttribute("filter");
    legendItem.removeAttribute("fill");
  }

  var q = rink.selectAll(".quadrant")
    .data(Object.keys(segmented))
    .enter()
    .append("g")
    .attr("aria-role", "region")
    .attr("aria-labelledby", d => "quadrant" + d);

  q.append("text")
    .attr("transform", d => translate(
      legend_offset[d].x,
      legend_offset[d].y - 45
    ))
    .text(d => config.quadrants[d].name)
    .attr("aria-role", "heading")
    .attr("id", d => "quandrant" + d )
    .style("font-family", "Arial, Helvetica")
    .style("font-size", "18px");

  var r = q.selectAll(".ring")
      .data(d => Object.keys(segmented[d]))
      .enter()
      .append("g")
      .attr("aria-role", "region")
      .attr("aria-labelledby", d => "ring" + d);
  r.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", d => rings[d].radius)
    .style("fill", "none")
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);
  r.append("text")
    .text(d => config.rings[d].name)
    .attr("id", d => "ring" + d)
    .attr("aria-role", "heading")
    .attr("x", d => d > 0 ? rings[d-1].radius + 1: 1)
    .attr("y", d => d % 2 ? 10 : -2)
    .attr("text-anchor", "left")
    .style("fill", "#777")
    .style("font-family", "Arial, Helvetica")
    .style("font-size", "10px")
    .style("font-weight", "bold")
    .style("pointer-events", "none")
    .style("user-select", "none");


  // draw blips on radar
  var blips = r.selectAll(".blip")
    .data(function(d) { return segmented[d3.select(this.parentNode).datum()][d]; })
    .enter()
      .append("g")
        .attr("class", "blip")
        .attr("aria-role", "graphics-symbol img")
        .attr("transform", function(d, i) { return legend_transform(d.quadrant, d.ring, i); })
        .on("focusin", showBubble)
        .on("focusout", hideBubble)
        .on("mouseover", showBubble)
        .on("mouseout", hideBubble);

  // configure each blip
  blips.each(function(d) {
    var blip = d3.select(this);
    blip.append("title")
      .text(d => d.label);
    blip.append("description")
      .text(d => d.label + " is in " + config.rings[d.ring].name + (d.lastMovedAt ? " since " + d.lastMovedAt : "" ) + (d.assignees.length ? " and is assigned to " + d.assignees.join(", ") : ""));
    // blip link
    if (d.hasOwnProperty("link")) {
      blip = blip.append("a")
        .attr("target", "_blank")
        .attr("xlink:href", d.link);
    }

    // blip shape
    const warning = d.assignees.length === 0 && d.ring < 4;
    const stroke =  warning ? 'red' : 'black';
    const strokeWidth = warning ? 2 : 1;
    const w = 8 + d.comments.length;
    const y1 = Math.round(5 * (18 + d.comments.length) / 18);
    const y2 = Math.round(13 * (18 + d.comments.length) / 18);
    if (d.moved > 0) {
      blip.append("path")
        .attr("d", "M -" + w + "," + y1 + " " + w + "," + y1 + " 0,-" + y2 + " z") // triangle pointing up
        .style("fill", d.color)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth);
    } else if (d.moved < 0) {
      blip.append("path")
        .attr("d", "M -" + w + ",-" + y1 + " " + w + ",-" + y1 + " 0," + y2 + " z") // triangle pointing down
        .style("fill", d.color)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth);
    } else {
      blip.append("circle")
        .attr("r", 9 + d.comments.length)
        .attr("fill", d.color)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth);
    }

    // blip text
    if (true || d.active || config.print_layout) {
      var blip_text = config.print_layout ? d.id : d.number;
      blip.append("text")
        .text(blip_text)
        .attr("y", 3)
        .attr("text-anchor", "middle")
        .style("fill", '#' + contrastedTextColor(d.color))
        .style("font-family", "Arial, Helvetica")
        .style("font-size", blip_text.length > 2 ? "8px" : "9px")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  });

  const labels = [...new Set([].concat(...config.entries.map(e => e.labels.map(l => l.name))).filter(l => !l.match(/review/i)))].sort();
  labels.push("no label");
  config.entries.forEach(e => {
    if (e.labels.filter(l => labels.includes(l.name)).length === 0) {
      e.labels.push({name: "no label", color: "ffffff"});
    }
  });
  var control = document.getElementById("control");
  const toggleLab = document.createElement("label");
  const toggleInp = document.createElement("input");
  toggleInp.type = "checkbox";
  toggleInp.checked = true;
  toggleInp.setAttribute("aria-controls", "labels");
  toggleLab.appendChild(toggleInp);
  toggleLab.appendChild(document.createTextNode("Toggle all"));
  control.appendChild(toggleLab);
  toggleInp.addEventListener("change", e =>
                             [...control.querySelectorAll("input")].forEach(inp => {
                               inp.checked = e.target.checked;
                               inp.dispatchEvent(new Event("input"));
                             })
                            );
  const fieldset = document.createElement("fieldset");
  fieldset.setAttribute("id", "labels");
  const leg = document.createElement("legend");
  leg.textContent = "Filter by label";
  fieldset.appendChild(leg);
  const labelVisibility = {};
  for (d of labels) {
    labelVisibility[d] = true;
    const lab = document.createElement("label");
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.checked = true;
    inp.value = d;
    inp.setAttribute("aria-controls", "radar");
    lab.appendChild(inp);
    fieldset.appendChild(lab);
    const numberOfEntries = config.entries.filter(e => e.labels.find(l => l.name === d)).length;
    const bgColor = '#' + config.entries.find(e => (e.labels || []).find(l => l.name === d)).labels.find(l => l.name === d).color;
    lab.style.backgroundColor =  bgColor;
    lab.style.color = "#" + contrastedTextColor(bgColor);
    lab.appendChild(document.createTextNode(d + " (" + numberOfEntries + ")"));

    inp.addEventListener("input", e => {
      if (e.target.checked) {
        labelVisibility[e.target.value] = true;
      } else {
        labelVisibility[e.target.value] = false;
      }
      const checkedLabels = Object.keys(labelVisibility).filter(d => labelVisibility[d]);
      blips.each(function(b) {
        var blip = d3.select(this);
        if (b.labels.some(l => checkedLabels.includes(l.name))) {
          blip.attr("style", "visibility: visible");
        } else {
          blip.attr("style", "visibility: hidden");
        }
      })
    });
    lab.addEventListener("mouseout", e => {
      blips.each(function(b) {
        var blip = d3.select(this);
        blip.classed("dimmed", false);
      })

    });
    lab.addEventListener("mouseover", e => {
      const domain = e.target.value || e.target.querySelector("input").value;
      blips.each(function(b) {
        var blip = d3.select(this);
        if (b.labels.find(l => l.name === domain)) {
          blip.classed("dimmed", false);
        } else {
          blip.classed("dimmed", true);
        }
      })

    });
  }
  control.appendChild(fieldset);



  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);
}
