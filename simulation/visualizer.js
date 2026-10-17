/**
 * GraphVisualizer: Canvas-based interactive cluster & connection visualizer
 * styled in the authentic Romeo & Juliet luxury editorial aesthetic.
 */

class GraphVisualizer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;
    this.nodes = new Map();
    this.edges = [];
    this.activeIntros = [];

    this.selectedNodeId = null;
    this.hoveredNodeId = null;

    // Pan & Zoom state
    this.scale = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // Animation time
    this.animTime = 0;

    this.initEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);
    if (this.nodes.size === 0) {
      this.panX = this.width / 2;
      this.panY = this.height / 2;
    }
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldX = (screenX - this.panX) / this.scale;
    const worldY = (screenY - this.panY) / this.scale;
    return { screenX, screenY, worldX, worldY };
  }

  findNodeAt(worldX, worldY) {
    for (const node of this.nodes.values()) {
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= node.radius + 5) {
        return node;
      }
    }
    return null;
  }

  onMouseDown(e) {
    const { worldX, worldY, screenX, screenY } = this.getCanvasCoords(e);
    const clickedNode = this.findNodeAt(worldX, worldY);

    if (clickedNode) {
      if (this.options.onNodeClick) {
        this.options.onNodeClick(clickedNode.member);
      }
      this.selectedNodeId = clickedNode.id;
    } else {
      this.isDragging = true;
      this.dragStartX = screenX - this.panX;
      this.dragStartY = screenY - this.panY;
    }
  }

  onMouseMove(e) {
    const { worldX, worldY, screenX, screenY } = this.getCanvasCoords(e);

    if (this.isDragging) {
      this.panX = screenX - this.dragStartX;
      this.panY = screenY - this.dragStartY;
      return;
    }

    const hoverNode = this.findNodeAt(worldX, worldY);
    if (hoverNode) {
      this.canvas.style.cursor = 'pointer';
      this.hoveredNodeId = hoverNode.id;
      if (this.options.onNodeHover) {
        this.options.onNodeHover(hoverNode.member, screenX, screenY);
      }
    } else {
      this.canvas.style.cursor = 'grab';
      this.hoveredNodeId = null;
      if (this.options.onNodeHover) {
        this.options.onNodeHover(null);
      }
    }
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const { screenX, screenY } = this.getCanvasCoords(e);

    const newScale = Math.min(Math.max(0.35, this.scale * zoomFactor), 3.5);
    this.panX = screenX - (screenX - this.panX) * (newScale / this.scale);
    this.panY = screenY - (screenY - this.panY) * (newScale / this.scale);
    this.scale = newScale;
  }

  updateData(members, currentDay, activeIntros = [], pastPairs = new Set()) {
    this.activeIntros = activeIntros;
    const currentMemberIds = new Set();

    // Map zones to authentic Romeo & Juliet cities
    const cityPositions = {
      zone_a: { name: 'DELHI', x: -220, y: -160, color: 'rgba(56, 86, 64, 0.06)' },
      zone_b: { name: 'BOMBAY', x: 220, y: -160, color: 'rgba(161, 54, 54, 0.05)' },
      zone_c: { name: 'BANGALORE', x: -220, y: 160, color: 'rgba(176, 125, 52, 0.06)' },
      zone_d: { name: 'CHANDIGARH', x: 220, y: 160, color: 'rgba(35, 37, 54, 0.05)' }
    };

    const sparseCities = [
      'DELHI', 'BOMBAY', 'BANGALORE', 'CHANDIGARH', 'JAIPUR', 'LONDON',
      'EDINBURGH', 'KOLKATA', 'HYDERABAD', 'CHENNAI', 'PUNE', 'GOA'
    ];

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      cityPositions[`zone_${i}`] = {
        name: sparseCities[i],
        x: Math.cos(angle) * 330,
        y: Math.sin(angle) * 330,
        color: 'rgba(90, 75, 55, 0.05)'
      };
    }

    this.cityPositions = cityPositions;

    for (const m of members) {
      currentMemberIds.add(m.member_id);
      let node = this.nodes.get(m.member_id);
      const isAvailable = m.available;
      const isExited = m.exit_day ? m.exit_day <= currentDay : false;

      let status = 'waiting';
      if (isExited) status = 'exited';
      else if (isAvailable) status = 'available';
      else status = 'busy';

      if (activeIntros.some(p => p[0] === m.member_id || p[1] === m.member_id)) {
        status = 'active_intro';
      }

      if (!node) {
        const cityInfo = cityPositions[m.zone] || { name: m.zone.toUpperCase(), x: 0, y: 0, color: '#f6f0e4' };
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 105 + 20;
        node = {
          id: m.member_id,
          x: cityInfo.x + Math.cos(angle) * dist,
          y: cityInfo.y + Math.sin(angle) * dist,
          targetX: cityInfo.x,
          targetY: cityInfo.y,
          vx: 0,
          vy: 0,
          radius: 9,
          cityName: cityInfo.name,
          member: m,
          status
        };
        this.nodes.set(m.member_id, node);
      } else {
        node.member = m;
        node.status = status;
      }
    }

    for (const id of Array.from(this.nodes.keys())) {
      if (!currentMemberIds.has(id)) {
        this.nodes.delete(id);
      }
    }

    // Build edges
    this.edges = [];
    for (const [u, v] of activeIntros) {
      if (this.nodes.has(u) && this.nodes.has(v)) {
        this.edges.push({ u, v, type: 'active' });
      }
    }

    const availableNodes = Array.from(this.nodes.values()).filter(n => n.status === 'available');
    let feasibleAdded = 0;
    for (let i = 0; i < availableNodes.length; i++) {
      if (feasibleAdded > 80) break;
      for (let j = i + 1; j < availableNodes.length; j++) {
        const a = availableNodes[i], b = availableNodes[j];
        const key = [a.id, b.id].sort().join('|');
        if (pastPairs.has(key)) continue;
        const elig = window.SimulationEngine.checkEligibility(a.member, b.member);
        if (elig.status === 'feasible') {
          this.edges.push({ u: a.id, v: b.id, type: 'feasible' });
          feasibleAdded++;
          if (feasibleAdded > 80) break;
        }
      }
    }
  }

  stepPhysics() {
    const nodeArray = Array.from(this.nodes.values());
    const kRepel = 1200;
    const kCenter = 0.025;

    for (let i = 0; i < nodeArray.length; i++) {
      const a = nodeArray[i];
      const dxCenter = a.targetX - a.x;
      const dyCenter = a.targetY - a.y;
      a.vx += dxCenter * kCenter;
      a.vy += dyCenter * kCenter;

      for (let j = i + 1; j < nodeArray.length; j++) {
        const b = nodeArray[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy + 100;
        const dist = Math.sqrt(distSq);

        if (dist < 72) {
          const force = kRepel / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      a.vx *= 0.82;
      a.vy *= 0.82;
      a.x += a.vx;
      a.y += a.vy;
    }
  }

  render() {
    this.animTime += 0.035;
    this.stepPhysics();

    const ctx = this.ctx;
    ctx.save();
    // Warm Parchment Background
    ctx.fillStyle = '#fbf8f2';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    this.drawGrid(ctx);
    this.drawCityBackdrops(ctx);
    this.drawEdges(ctx);
    this.drawNodes(ctx);

    ctx.restore();
  }

  drawGrid(ctx) {
    const gridSize = 80;
    const minX = -1200;
    const maxX = 1200;
    const minY = -1000;
    const maxY = 1000;

    ctx.strokeStyle = 'rgba(90, 75, 55, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = minX; x <= maxX; x += gridSize) {
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
    }
    for (let y = minY; y <= maxY; y += gridSize) {
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
    }
    ctx.stroke();
  }

  drawCityBackdrops(ctx) {
    if (!this.cityPositions) return;

    // Determine which zones are present in active nodes
    const activeZones = new Set();
    for (const node of this.nodes.values()) {
      if (node.member && node.member.zone) {
        activeZones.add(node.member.zone);
      }
    }

    for (const [key, city] of Object.entries(this.cityPositions)) {
      // If we have active nodes, only draw zones present in the current pool
      if (activeZones.size > 0 && !activeZones.has(key)) {
        continue;
      }

      // Delicate circular boundary ring
      ctx.save();
      ctx.fillStyle = city.color || 'rgba(90, 75, 55, 0.04)';
      ctx.beginPath();
      ctx.arc(city.x, city.y, 145, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(125, 115, 100, 0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(city.x, city.y, 145, 0, Math.PI * 2);
      ctx.stroke();

      // Elegant tracked city name
      ctx.fillStyle = '#40382d';
      ctx.font = '600 12px "Montserrat", -apple-system, sans-serif';
      ctx.letterSpacing = '0.18em';
      ctx.textAlign = 'center';
      ctx.fillText(city.name, city.x, city.y - 122);

      ctx.fillStyle = '#8c8577';
      ctx.font = 'italic 11px "Cormorant Garamond", serif';
      ctx.fillText('Registry Territory', city.x, city.y - 108);

      ctx.restore();
    }
  }

  drawEdges(ctx) {
    for (const edge of this.edges) {
      const uNode = this.nodes.get(edge.u);
      const vNode = this.nodes.get(edge.v);
      if (!uNode || !vNode) continue;

      const isHighlighted = (this.hoveredNodeId === edge.u || this.hoveredNodeId === edge.v ||
                             this.selectedNodeId === edge.u || this.selectedNodeId === edge.v);

      if (edge.type === 'active') {
        // The Crimson Thread of Fate
        ctx.save();
        ctx.strokeStyle = '#a13636';
        ctx.lineWidth = isHighlighted ? 3.5 : 2.2;
        ctx.shadowColor = 'rgba(161, 54, 54, 0.35)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(uNode.x, uNode.y);
        ctx.lineTo(vNode.x, vNode.y);
        ctx.stroke();

        // Traveling pearl bead along thread
        const t = (Math.sin(this.animTime * 2.8) + 1) / 2;
        const dotX = uNode.x + (vNode.x - uNode.x) * t;
        const dotY = uNode.y + (vNode.y - uNode.y) * t;
        ctx.fillStyle = '#fbf8f2';
        ctx.strokeStyle = '#a13636';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (edge.type === 'feasible') {
        // Feasible pairing connection in soft botanical ink
        ctx.save();
        ctx.strokeStyle = isHighlighted ? 'rgba(56, 86, 64, 0.75)' : 'rgba(56, 86, 64, 0.12)';
        ctx.lineWidth = isHighlighted ? 1.8 : 0.8;
        ctx.beginPath();
        ctx.moveTo(uNode.x, uNode.y);
        ctx.lineTo(vNode.x, vNode.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawNodes(ctx) {
    for (const node of this.nodes.values()) {
      const isSelected = this.selectedNodeId === node.id;
      const isHovered = this.hoveredNodeId === node.id;

      let fillColor = '#385640'; // Botanical sage
      let strokeColor = '#fbf8f2';
      let shadowColor = null;

      if (node.status === 'available') {
        fillColor = '#385640'; // Botanical sage
        shadowColor = 'rgba(56, 86, 64, 0.3)';
      } else if (node.status === 'active_intro') {
        fillColor = '#a13636'; // Wax crimson
        shadowColor = 'rgba(161, 54, 54, 0.5)';
      } else if (node.status === 'busy') {
        fillColor = '#b07d34'; // Antique ochre / brass
        shadowColor = 'rgba(176, 125, 52, 0.3)';
      } else if (node.status === 'exited') {
        fillColor = '#9e978a'; // Muted stone
      }

      ctx.save();

      // Outer halo for selected/hovered nodes
      if (isSelected || isHovered) {
        ctx.shadowColor = shadowColor || 'rgba(56, 86, 64, 0.4)';
        ctx.shadowBlur = 12;
      }

      // Double seal ring for selected node
      if (isSelected) {
        ctx.strokeStyle = '#232536';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main Node Circle
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = isHovered ? '#232536' : strokeColor;
      ctx.lineWidth = isHovered ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? node.radius + 2 : node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Node Initial in Classical Serif
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 8.5px "Cormorant Garamond", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = node.member.gender ? node.member.gender[0].toUpperCase() : 'M';
      ctx.fillText(initial, node.x, node.y + 0.5);

      ctx.restore();
    }
  }

  focusNode(id) {
    const node = this.nodes.get(id);
    if (node) {
      this.selectedNodeId = id;
      this.panX = this.width / 2 - node.x * this.scale;
      this.panY = this.height / 2 - node.y * this.scale;
    }
  }
}

if (typeof window !== 'undefined') {
  window.GraphVisualizer = GraphVisualizer;
}
