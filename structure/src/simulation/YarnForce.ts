// Adapted from https://github.com/d3/d3-force/blob/main/src/link.js

function constant(x: number) {
  return function () {
    return x;
  };
}

function jiggle(random: () => number): number {
  return (random() - 0.5) * 1e-6;
}

function index(d: any): number {
  return d.index;
}

function find(nodeById: Map<number, any>, nodeId: number): any {
  const node = nodeById.get(nodeId);
  if (!node) throw new Error("node not found: " + nodeId);
  return node;
}

export function yarnLinkForce(links: any[]) {
  let id = index as (d: any, i?: number, nodes?: any[]) => number;
  let strength: (link: any, i?: number, links?: any[]) => number =
    defaultStrength;
  let strengths: number[];
  let distance: (link: any, i?: number, links?: any[]) => number = constant(30);
  let distances: number[];
  let nodes: any[];
  let count: number[];
  let bias: number[];
  let random: () => number;
  let iterations = 1;

  if (links == null) links = [];

  function defaultStrength(link: any): number {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }

  function force(alpha: number): void {
    for (let k = 0, n = links.length; k < iterations; ++k) {
      for (let i = 0; i < n; ++i) {
        const link = links[i];
        const source = link.source;
        const target = link.target;
        let x =
          target.x + target.vx - source.x - source.vx || jiggle(random);
        let y =
          target.y + target.vy - source.y - source.vy || jiggle(random);
        let l = Math.sqrt(x * x + y * y);

        if (link.linkType == "FLFH" || link.linkType == "LHLL") {
          if (Math.sign(l - distances[i]) <= 0)
            l = ((l - distances[i]) / l) * alpha * 0.001;
          else {
            l = ((l - distances[i]) / l) * alpha * 0.2;
          }
        } else {
          l = ((l - distances[i]) / l) * alpha * 0.5;
        }

        x *= l;
        y *= l;
        let b = bias[i];
        target.vx -= x * b;
        target.vy -= y * b;
        b = 1 - b;
        source.vx += x * b;
        source.vy += y * b;
      }
    }
  }

  function initialize(): void {
    if (!nodes) return;

    const n = nodes.length;
    const m = links.length;
    const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));

    count = new Array(n);
    for (let i = 0; i < m; ++i) {
      const link = links[i];
      link.index = i;
      if (typeof link.source !== "object")
        link.source = find(nodeById, link.source);
      if (typeof link.target !== "object")
        link.target = find(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }

    bias = new Array(m);
    for (let i = 0; i < m; ++i) {
      const link = links[i];
      bias[i] =
        count[link.source.index] /
        (count[link.source.index] + count[link.target.index]);
    }

    strengths = new Array(m);
    initializeStrength();
    distances = new Array(m);
    initializeDistance();
  }

  function initializeStrength(): void {
    if (!nodes) return;

    for (let i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }

  function initializeDistance(): void {
    if (!nodes) return;

    for (let i = 0, n = links.length; i < n; ++i) {
      distances[i] = +distance(links[i], i, links);
    }
  }

  force.initialize = function (_nodes: any[], _random: () => number): void {
    nodes = _nodes;
    random = _random;
    initialize();
  };

  force.links = function (_?: any[]): any {
    return arguments.length ? ((links = _!), initialize(), force) : links;
  };

  force.id = function (_?: (d: any, i?: number, nodes?: any[]) => number): any {
    return arguments.length ? ((id = _!), force) : id;
  };

  force.iterations = function (_?: number): any {
    return arguments.length ? ((iterations = +_!), force) : iterations;
  };

  force.strength = function (
    _?: number | ((link: any, i?: number, links?: any[]) => number)
  ): any {
    return arguments.length
      ? ((strength =
          typeof _ === "function" ? _ : constant(+(_ as number))),
        initializeStrength(),
        force)
      : strength;
  };

  force.distance = function (
    _?: number | ((link: any, i?: number, links?: any[]) => number)
  ): any {
    return arguments.length
      ? ((distance =
          typeof _ === "function" ? _ : constant(+(_ as number))),
        initializeDistance(),
        force)
      : distance;
  };

  return force;
}
