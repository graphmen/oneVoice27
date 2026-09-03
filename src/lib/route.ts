import { haversineMeters } from "./geo";

export type RoutePoint = { lat: number; lng: number };

export type RouteStep = {
  instruction: string;
  distance: number;
  duration: number;
  location: RoutePoint;
};

export type DriveRoute = {
  distance: number;
  duration: number;
  points: RoutePoint[];
  steps: RouteStep[];
};

type OsrmManeuver = {
  type?: string;
  modifier?: string;
  location?: [number, number];
};

type OsrmStep = {
  name?: string;
  distance?: number;
  duration?: number;
  maneuver?: OsrmManeuver;
};

type OsrmResponse = {
  code?: string;
  routes?: {
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: { steps?: OsrmStep[] }[];
  }[];
};

function modifierWord(mod?: string) {
  if (!mod) return "";
  return mod.replace(/_/g, " ");
}

function stepInstruction(step: OsrmStep) {
  const type = step.maneuver?.type || "";
  const mod = modifierWord(step.maneuver?.modifier);
  const road = step.name?.trim() || "the road";
  if (type === "depart") return `Head ${mod || "out"} on ${road}`;
  if (type === "arrive") return "Arrive at the member’s home";
  if (type === "turn") return `Turn ${mod || "ahead"} onto ${road}`;
  if (type === "new name") return `Continue onto ${road}`;
  if (type === "merge") return `Merge ${mod || "ahead"} onto ${road}`;
  if (type === "on ramp") return `Take the ramp ${mod || ""} onto ${road}`.replace(/\s+/g, " ").trim();
  if (type === "off ramp" || type === "exit") return `Take the exit ${mod || ""} toward ${road}`.replace(/\s+/g, " ").trim();
  if (type === "fork") return `Keep ${mod || "ahead"} at the fork onto ${road}`;
  if (type === "end of road") return `Turn ${mod || "ahead"} at the end of the road onto ${road}`;
  if (type === "roundabout" || type === "rotary") return `Enter the roundabout and continue onto ${road}`;
  if (type === "roundabout turn") return `At the roundabout, take the ${mod || ""} onto ${road}`.replace(/\s+/g, " ").trim();
  if (type === "continue") return `Continue ${mod || "straight"} on ${road}`;
  return mod ? `Continue ${mod} on ${road}` : `Continue on ${road}`;
}

export async function fetchDriveRoute(from: RoutePoint, to: RoutePoint): Promise<DriveRoute> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true&alternatives=false`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Route request failed");
  const data = (await res.json()) as OsrmResponse;
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error("No driving route found");
  const points =
    route.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [from, to];
  const steps: RouteStep[] = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => {
      const loc = step.maneuver?.location;
      return {
        instruction: stepInstruction(step),
        distance: step.distance || 0,
        duration: step.duration || 0,
        location: loc ? { lat: loc[1], lng: loc[0] } : points[0] || from,
      };
    }),
  );
  if (!steps.length) {
    steps.push({
      instruction: "Drive to the member’s home",
      distance: route.distance,
      duration: route.duration,
      location: to,
    });
  }
  return {
    distance: route.distance,
    duration: route.duration,
    points,
    steps,
  };
}

export function currentStepIndex(steps: RouteStep[], here: RoutePoint) {
  let i = 0;
  while (i < steps.length - 1) {
    const hereToThis = haversineMeters(here.lat, here.lng, steps[i].location.lat, steps[i].location.lng);
    const hereToNext = haversineMeters(here.lat, here.lng, steps[i + 1].location.lat, steps[i + 1].location.lng);
    if (hereToNext + 28 < hereToThis || hereToThis < 18) i += 1;
    else break;
  }
  return i;
}

export function straightLineRoute(from: RoutePoint, to: RoutePoint): DriveRoute {
  const distance = haversineMeters(from.lat, from.lng, to.lat, to.lng);
  return {
    distance,
    duration: distance / 8.3,
    points: [from, to],
    steps: [
      {
        instruction: "Head toward the home (direct line — road directions need internet)",
        distance,
        duration: distance / 8.3,
        location: to,
      },
    ],
  };
}
