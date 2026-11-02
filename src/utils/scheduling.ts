import axios from 'axios';

export const DAY_CAPACITY_MIN = 480;
export const DEFAULT_JOB_MINUTES = 120; // used for orders saved before this feature
const FALLBACK_ONE_WAY_MIN = 45; // used if the routing service is unreachable

// Work time on site. Replace with SESMYL's real figures.
const WORK_RULES = {
  Delivery: { fixed: 30, perM2: 0.5 },
  Installation: { fixed: 60, perM2: 3 },
};

export interface JobEstimate {
  distanceKm: number | null;
  travelMinutes: number; // round trip
  workMinutes: number;
  totalMinutes: number;
  travelFromRouting: boolean;
}

const getOneWayTravel = async (
  lat: number,
  lon: number
): Promise<{ minutes: number; km: number } | null> => {
  const baseLat = Number(process.env.BASE_LAT ?? -25.7479);
  const baseLon = Number(process.env.BASE_LON ?? 28.2293);

  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${baseLon},${baseLat};${lon},${lat}`,
      { params: { overview: 'false' }, timeout: 8000 }
    );
    const route = response.data?.routes?.[0];
    if (!route) return null;

    return {
      minutes: Math.ceil(route.duration / 60),
      km: Math.round(route.distance / 100) / 10,
    };
  } catch (error: any) {
    console.error('OSRM error:', error.message);
    return null;
  }
};

export const estimateJob = async (
  lat: number,
  lon: number,
  area: number,
  serviceType: string
): Promise<JobEstimate> => {
  const travel = await getOneWayTravel(lat, lon);
  const oneWay = travel ? travel.minutes : FALLBACK_ONE_WAY_MIN;
  const rules = WORK_RULES[serviceType as 'Delivery' | 'Installation'];

  const travelMinutes = oneWay * 2;
  const workMinutes = Math.ceil(rules.fixed + rules.perM2 * area);

  return {
    distanceKm: travel ? travel.km : null,
    travelMinutes,
    workMinutes,
    totalMinutes: travelMinutes + workMinutes,
    travelFromRouting: travel !== null,
  };
};