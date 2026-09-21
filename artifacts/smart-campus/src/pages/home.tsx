import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  ArrowUpRight,
  AudioLines,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Compass,
  Crosshair,
  Footprints,
  LocateFixed,
  MapPin,
  Menu,
  Navigation,
  PanelRightOpen,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

type RoutePoint = { lat: number; lng: number };
type RouteResult = {
  points: RoutePoint[];
  distance?: string;
  duration?: string;
  destination?: string;
  directions?: string[];
};
type CampusEvent = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  category: string;
  description?: string;
};

declare global {
  interface Window {
    L?: any;
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const destinations = [
  { name: 'TCE Administration Block', detail: 'Principal, administration, and student services', icon: Building2 },
  { name: 'Thiagarajar Central Library', detail: 'Central library and study spaces', icon: Compass },
  { name: 'CSE Department', detail: 'Computer Science and Engineering', icon: Sparkles },
  { name: 'ECE Department', detail: 'Electronics and Communication Engineering', icon: Accessibility },
  { name: 'TCE Main Auditorium', detail: 'Talks, performances, and college gatherings', icon: MapPin },
  { name: 'TCE Campus Canteen', detail: 'Meals, snacks, and student seating', icon: MapPin },
  { name: 'TCE Hostel Block', detail: 'Student residence and hostel services', icon: Building2 },
  { name: 'TCE AICTE Idea Lab', detail: 'Innovation and prototyping space', icon: Sparkles },
  { name: 'TCE Sports Ground', detail: 'Sports facilities and outdoor activity', icon: Compass },
];

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function parsePoint(value: unknown, coordinateOrder: 'latlng' | 'lnglat' = 'latlng'): RoutePoint | null {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
    return coordinateOrder === 'lnglat' ? { lat: second, lng: first } : { lat: first, lng: second };
  }
  const point = asRecord(value);
  const lat = Number(point.lat ?? point.latitude ?? point.y);
  const lng = Number(point.lng ?? point.lon ?? point.longitude ?? point.x);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function normalizeRoute(payload: unknown, destination: string): RouteResult {
  const root = asRecord(payload);
  const geo = asRecord(root.geometry ?? asRecord(root.data).geometry);
  const geoCoordinates = Array.isArray(geo.coordinates) ? geo.coordinates : null;
  const source = geoCoordinates
    ?? root.coordinates
    ?? root.path
    ?? root.route
    ?? root.waypoints
    ?? asRecord(root.data).coordinates
    ?? asRecord(root.data).route
    ?? (Array.isArray(payload) ? payload : []);
  const points = Array.isArray(source)
    ? source.map((point) => parsePoint(point, geoCoordinates ? 'lnglat' : 'latlng')).filter((point): point is RoutePoint => Boolean(point))
    : [];
  return {
    points,
    destination,
    distance: String(root.distance ?? root.distance_label ?? root.distanceText ?? asRecord(root.data).distance ?? ''),
    duration: root.total_minutes ? `${root.total_minutes} min walk` : String(root.duration ?? root.durationText ?? asRecord(root.data).duration ?? ''),
    directions: Array.isArray(root.directions) ? root.directions.map((item) => String(asRecord(item).text ?? item)) : [],
  };
}

function normalizeEvents(payload: unknown): CampusEvent[] {
  const root = asRecord(payload);
  const source = Array.isArray(payload) ? payload : (root.events ?? root.data ?? []);
  if (!Array.isArray(source)) return [];
  return source.map((item, index) => {
    const event = asRecord(item);
    return {
      id: String(event.id ?? event._id ?? index),
      title: String(event.title ?? event.name ?? 'Campus gathering'),
      location: String(event.location ?? event.venue ?? event.building ?? 'Campus'),
      startsAt: String(event.startsAt ?? event.startTime ?? event.date ?? event.datetime ?? event.time ?? ''),
      category: String(event.category ?? event.type ?? 'Campus life'),
      description: event.description ? String(event.description) : undefined,
    };
  });
}

function formatEventTime(value: string) {
  if (!value) return 'Time to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise<any>((resolve, reject) => {
    const loadDecorator = () => {
      if (window.L?.polylineDecorator) {
        resolve(window.L);
        return;
      }
      const decorator = document.createElement('script');
      decorator.src = 'https://unpkg.com/leaflet-polylinedecorator@1.6.0/dist/leaflet.polylineDecorator.js';
      decorator.async = true;
      decorator.dataset.leafletDecorator = 'true';
      decorator.onload = () => resolve(window.L);
      decorator.onerror = () => resolve(window.L);
      document.head.appendChild(decorator);
    };
    const existing = document.querySelector('script[data-leaflet]');
    if (existing) {
      existing.addEventListener('load', loadDecorator);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.dataset.leaflet = 'true';
    script.onload = loadDecorator;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function MapSurface({ route, onLocate }: { route: RouteResult | null; onLocate: () => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let map: any;
    loadLeaflet().then((L) => {
      if (!mounted || !elementRef.current || !L) return;
      const leafletCss = document.querySelector('link[data-leaflet-css]');
      if (!leafletCss) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.leafletCss = 'true';
        document.head.appendChild(link);
      }
      map = L.map(elementRef.current, { zoomControl: false, attributionControl: true }).setView([9.8816, 78.0834], 17);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    }).catch(() => setMapFailed(true));
    return () => {
      mounted = false;
      if (map) map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    if (routeLayerRef.current) routeLayerRef.current.remove();
    const layer = L.layerGroup().addTo(map);
    routeLayerRef.current = layer;
    if (!route?.points.length) return;
    const points = route.points.map((point) => [point.lat, point.lng]);
    const polyline = L.polyline(points, { color: '#087b78', weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
    L.polyline(points, { color: '#f4c267', weight: 2, opacity: 1, dashArray: '1 12', lineCap: 'round' }).addTo(layer);
    if (typeof L.polylineDecorator === 'function') {
      L.polylineDecorator(polyline, {
        patterns: [{ offset: '12%', repeat: '18%', symbol: L.Symbol.arrowHead({ pixelSize: 10, polygon: false, pathOptions: { color: '#087b78', weight: 3 } }) }],
      }).addTo(layer);
    }
    points.forEach((point: number[], index: number) => {
      if (index === 0 || index % 2 !== 0 || index >= points.length - 1) return;
      const previous = points[index - 1];
      const next = points[index + 1];
      const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]) * 180 / Math.PI;
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:block;transform:rotate(${angle - 90}deg);color:#087b78;font-size:22px;line-height:18px">▲</span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker(point, { icon, interactive: false }).addTo(layer);
    });
    L.circleMarker(points[0], { radius: 8, color: '#f8f3e8', weight: 4, fillColor: '#e3a43b', fillOpacity: 1 }).bindTooltip('You are here', { direction: 'top', offset: [0, -7], className: 'map-label' }).addTo(layer);
    L.circleMarker(points[points.length - 1], { radius: 8, color: '#f8f3e8', weight: 4, fillColor: '#087b78', fillOpacity: 1 }).bindTooltip(route.destination ?? 'Destination', { direction: 'top', offset: [0, -7], className: 'map-label' }).addTo(layer);
    map.fitBounds(polyline.getBounds(), { padding: [46, 46], maxZoom: 18 });
  }, [route]);

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-[1.35rem] border border-[hsl(var(--border))] bg-[#dfeae5]">
      <div ref={elementRef} className="absolute inset-0 z-0" data-testid="map-campus" />
      {!mapReady && !mapFailed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#e5eee9]/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full bg-[hsl(var(--card))] px-4 py-3 text-sm text-muted-foreground shadow-md">
            <span className="h-2 w-2 rounded-full bg-primary pulse-dot" /> Preparing the campus map
          </div>
        </div>
      )}
      {mapFailed && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#e5eee9] p-8 text-center">
          <div className="max-w-xs">
            <CircleAlert className="mx-auto mb-3 h-7 w-7 text-secondary-foreground" />
            <p className="font-semibold text-foreground">Map tiles are taking a break.</p>
            <p className="mt-1 text-sm text-muted-foreground">Your route is still available in the directions panel.</p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 z-[400] flex items-center gap-2 rounded-full border border-white/70 bg-[hsl(var(--card)/.9)] px-3 py-2 text-[11px] font-semibold tracking-wide text-primary shadow-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-[#e3a43b] pulse-dot" /> LIVE CAMPUS MAP
      </div>
      <button type="button" onClick={onLocate} className="absolute bottom-4 left-4 z-[400] flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-[hsl(var(--card)/.92)] text-primary shadow-md transition-transform hover:-translate-y-0.5" aria-label="Center on current location" data-testid="button-center-location">
        <LocateFixed className="h-4 w-4" />
      </button>
    </div>
  );
}

function EventSkeleton() {
  return <div className="flex gap-3 border-b border-border py-3 last:border-0"><div className="h-10 w-10 animate-pulse rounded-xl bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-2 w-1/3 animate-pulse rounded bg-muted" /></div></div>;
}

export default function Home() {
  const [destinationInput, setDestinationInput] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('Ask for a place, building, or the quickest way across campus.');
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);

  const chosen = useMemo(() => destinations.find((item) => item.name === selectedDestination), [selectedDestination]);

  async function fetchEvents() {
    setEventsLoading(true);
    setEventsError('');
    try {
      const response = await fetch('/events');
      if (!response.ok) throw new Error(`Events request failed (${response.status})`);
      setEvents(normalizeEvents(await response.json()));
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'Unable to load campus events.');
    } finally {
      setEventsLoading(false);
    }
  }

  async function findRoute(destination: string) {
    const trimmed = destination.trim();
    if (!trimmed) {
      setRouteError('Choose a destination before asking for directions.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRouteLoading(true);
    setRouteError('');
    setSelectedDestination(trimmed);
    try {
      const response = await fetch(`/navigation-route?destination=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Route request failed (${response.status})`);
      const result = normalizeRoute(await response.json(), trimmed);
      setRoute(result);
      setVoiceMessage(`Here is the clearest route to ${trimmed}.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setRouteError(error instanceof Error ? error.message : 'Unable to find a route right now.');
      setRoute(null);
    } finally {
      if (!controller.signal.aborted) setRouteLoading(false);
    }
  }

  useEffect(() => { void fetchEvents(); return () => abortRef.current?.abort(); }, []);

  function useDestination(name: string) {
    setDestinationInput(name);
    void findRoute(name);
  }

  function toggleListening() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setVoiceOpen(true);
    if (!Recognition) {
      setVoiceMessage('Voice input is not available in this browser. You can still type a destination below.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => { setListening(true); setVoiceMessage('Listening. Tell me where you are headed.'); };
    recognition.onerror = () => { setListening(false); setVoiceMessage('I could not catch that. Try again or type a destination.'); };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? '').trim();
      if (!transcript) return;
      setDestinationInput(transcript);
      const match = destinations.find((item) => transcript.toLowerCase().includes(item.name.toLowerCase()));
      if (match) void findRoute(match.name);
      else setVoiceMessage(`I heard “${transcript}”. Choose a matching destination or search the map.`);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  function speakDirections() {
    if (!route) return;
    window.speechSynthesis?.cancel();
    const steps = route.directions?.length ? ` ${route.directions.join('. ')}` : '';
    const text = `Your route to ${route.destination ?? selectedDestination} is ready. ${route.duration ? `It should take about ${route.duration}.` : ''}${steps}`;
    if (window.speechSynthesis) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      setVoiceMessage('Reading your route aloud now.');
    }
  }

  return (
    <main className="app-shell soft-grid min-h-[100dvh] overflow-x-hidden">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1600px]">
        <aside className="hidden w-[76px] shrink-0 flex-col items-center border-r border-border/70 bg-[hsl(var(--background)/.72)] py-6 md:flex">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm" data-testid="brand-mark"><Navigation className="h-5 w-5" /></div>
          <div className="mt-16 flex flex-col items-center gap-3">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary" aria-label="Wayfinding" data-testid="button-nav-wayfinding"><RouteIcon className="h-5 w-5" /></button>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-primary" aria-label="Campus events" data-testid="button-nav-events" onClick={() => document.getElementById('campus-events')?.scrollIntoView({ behavior: 'smooth' })}><CalendarDays className="h-5 w-5" /></button>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-accent hover:text-primary" aria-label="Notifications" data-testid="button-nav-notifications"><Bell className="h-5 w-5" /></button>
          </div>
          <div className="mt-auto grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-xs font-bold text-primary" data-testid="avatar-user">AM</div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-primary md:hidden" aria-label="Open menu" data-testid="button-open-menu"><Menu className="h-5 w-5" /></button>
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[.22em] text-muted-foreground">TCE / campus wayfinder</p>
                <h1 className="mt-1 text-xl font-extrabold tracking-[-.04em] text-foreground sm:text-2xl">Good morning, TCE student<span className="text-secondary-foreground">.</span></h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-2 text-[11px] font-semibold text-muted-foreground sm:flex"><span className="h-2 w-2 rounded-full bg-[#3b9b74] pulse-dot" /> Campus services online</div>
              <button type="button" onClick={toggleListening} className="flex h-10 items-center gap-2 rounded-xl bg-secondary px-3 text-xs font-bold text-secondary-foreground shadow-sm transition-transform hover:-translate-y-0.5 sm:px-4" data-testid="button-header-voice"><AudioLines className="h-4 w-4" /><span className="hidden sm:inline">Ask campus</span></button>
            </div>
          </header>

          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="rise-in">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">Your next step</p>
                    <h2 className="mt-1 max-w-xl text-3xl font-extrabold leading-[1.1] tracking-[-.055em] text-foreground sm:text-5xl">Find your way<br /><span className="text-primary">without the guesswork.</span></h2>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Local time</p>
                    <p className="mt-1 text-sm font-bold text-foreground">{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date())}</p>
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
                    <Search className="h-5 w-5 shrink-0 text-primary" />
                    <input value={destinationInput} onChange={(event) => setDestinationInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void findRoute(destinationInput); }} placeholder="Where would you like to go?" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-medium outline-none placeholder:text-muted-foreground" aria-label="Search campus destination" data-testid="input-destination" />
                    {destinationInput && <button type="button" onClick={() => setDestinationInput('')} className="text-muted-foreground hover:text-foreground" aria-label="Clear destination" data-testid="button-clear-destination"><X className="h-4 w-4" /></button>}
                  </div>
                  <button type="button" onClick={() => void findRoute(destinationInput)} disabled={routeLoading} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70" data-testid="button-find-route">{routeLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />} {routeLoading ? 'Finding route' : 'Find my way'}</button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {destinations.slice(0, 4).map((item) => <button type="button" key={item.name} onClick={() => useDestination(item.name)} className="shrink-0 rounded-full border border-border bg-card/70 px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary" data-testid={`button-destination-${item.name.toLowerCase().replaceAll(' ', '-')}`}>{item.name}</button>)}
                </div>
              </div>

              <div className="mt-6 rise-in delay-1">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-primary"><MapPin className="h-4 w-4" /></span><h3 className="text-sm font-bold">Live route view</h3></div>
                  {route && <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground"><span className="flex items-center gap-1"><Footprints className="h-3.5 w-3.5 text-primary" /> {route.duration || 'Route ready'}</span><span className="hidden sm:inline">{route.distance}</span></div>}
                </div>
                <div className="h-[390px] sm:h-[470px]"><MapSurface route={route} onLocate={() => window.L && mapLocationFallback()} /></div>
                {routeError && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" data-testid="status-route-error"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4 shrink-0" /> {routeError}</span><button type="button" onClick={() => void findRoute(selectedDestination || destinationInput)} className="font-bold underline" data-testid="button-retry-route">Try again</button></div>}
                {!route && !routeLoading && !routeError && <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><Crosshair className="h-3.5 w-3.5 text-secondary-foreground" /> Select a destination to draw the shortest available path.</div>}
              </div>
            </div>

            <aside className="rise-in delay-2 space-y-4">
              <div className="glass-panel rounded-[1.35rem] p-5">
                <div className="flex items-start justify-between">
                  <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Current guidance</p><h3 className="mt-2 text-lg font-extrabold tracking-[-.04em]">{chosen ? chosen.name : 'Ready when you are'}</h3></div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/30 text-secondary-foreground"><Navigation className="h-4 w-4" /></span>
                </div>
                {route ? <><div className="my-5 flex items-center gap-3"><div className="flex-1"><div className="h-1.5 rounded-full bg-accent"><div className="h-1.5 w-[62%] rounded-full bg-primary" /></div></div><span className="font-mono text-[10px] text-primary">PATH SET</span></div><div className="space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-muted-foreground">Destination</span><strong>{route.destination}</strong></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Walking time</span><strong>{route.duration || 'See map'}</strong></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Distance</span><strong>{route.distance || 'Calculated live'}</strong></div></div><button type="button" onClick={speakDirections} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-accent py-3 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground" data-testid="button-speak-directions"><Volume2 className="h-4 w-4" /> Read directions aloud</button></> : <div className="mt-5 rounded-xl bg-accent/70 p-4"><p className="text-sm leading-6 text-muted-foreground">Tell me where you’re headed and I’ll turn it into a simple walk, step by step.</p><button type="button" onClick={toggleListening} className="mt-4 flex items-center gap-2 text-xs font-bold text-primary" data-testid="button-start-guidance"><AudioLines className="h-4 w-4" /> Start with your voice <ArrowUpRight className="h-3.5 w-3.5" /></button></div>}
              </div>
              <div className="rounded-[1.35rem] border border-primary/15 bg-primary p-5 text-primary-foreground shadow-md">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary-foreground/65"><CheckCircle2 className="h-3.5 w-3.5" /> Campus note</div>
                <p className="mt-3 text-sm font-semibold leading-6">Find departments, facilities, hostels, and campus services across Thiagarajar College of Engineering.</p>
                <div className="mt-4 h-px bg-primary-foreground/15" /><p className="mt-3 font-mono text-[10px] text-primary-foreground/60">THIRUPPARANKUNDRAM · MADURAI</p>
              </div>
            </aside>
          </div>

          <section id="campus-events" className="mt-10 border-t border-border pt-7 rise-in delay-3">
            <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Happening nearby</p><h2 className="mt-1 text-2xl font-extrabold tracking-[-.05em]">Campus events</h2></div><button type="button" onClick={() => void fetchEvents()} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-primary hover:bg-accent" data-testid="button-refresh-events"><RefreshCw className={`h-3.5 w-3.5 ${eventsLoading ? 'animate-spin' : ''}`} /> Refresh</button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {eventsLoading ? <><EventSkeleton /><EventSkeleton /><EventSkeleton /></> : eventsError ? <div className="col-span-full flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive" data-testid="status-events-error"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4" /> {eventsError}</span><button type="button" onClick={() => void fetchEvents()} className="font-bold underline" data-testid="button-retry-events">Retry</button></div> : events.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center" data-testid="empty-events"><CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No events are listed right now.</p><p className="mt-1 text-xs text-muted-foreground">Check back later for what’s happening around campus.</p></div> : events.slice(0, 6).map((event) => <article key={event.id} className="group rounded-2xl border border-border bg-card/80 p-4 transition-transform hover:-translate-y-0.5 hover:shadow-sm" data-testid={`card-event-${event.id}`}><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-accent px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-wide text-primary">{event.category}</span><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><h3 className="mt-4 text-sm font-bold">{event.title}</h3><div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground"><p className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-secondary-foreground" /> {formatEventTime(event.startsAt)}</p><p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-secondary-foreground" /> {event.location}</p></div>{event.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{event.description}</p>}</article>)}
            </div>
          </section>
        </section>
      </div>

      {voiceOpen && <div className="fixed inset-0 z-[900] bg-[hsl(197_44%_16%/.2)] backdrop-blur-[2px]" onClick={() => setVoiceOpen(false)} aria-hidden="true" />}
      <section className={`glass-panel fixed right-3 top-3 z-[910] flex w-[calc(100%-1.5rem)] max-w-[390px] flex-col rounded-[1.5rem] p-5 transition-transform duration-300 sm:right-6 sm:top-6 ${voiceOpen ? 'translate-x-0' : 'pointer-events-none translate-x-[120%]'}`} aria-label="Voice assistant" data-testid="drawer-voice-assistant">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-2xl ${listening ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}><AudioLines className={`h-5 w-5 ${listening ? 'pulse-dot' : ''}`} /></div><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Voice assistant</p><h2 className="mt-0.5 text-base font-extrabold">Campus companion</h2></div></div><button type="button" onClick={() => setVoiceOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-primary" aria-label="Close voice assistant" data-testid="button-close-voice"><X className="h-4 w-4" /></button></div>
        <div className="relative mt-8 overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground"><div className="scan-line absolute left-0 right-0 top-0 h-8 bg-gradient-to-b from-transparent via-secondary/25 to-transparent" /><div className="relative"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary-foreground/60">{listening ? 'Listening now' : 'Ready to listen'}</p><p className="mt-3 text-lg font-bold leading-7">“{voiceMessage}”</p></div></div>
        <button type="button" onClick={toggleListening} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 ${listening ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`} data-testid="button-toggle-listening">{listening ? <><span className="h-2 w-2 rounded-full bg-secondary-foreground pulse-dot" /> Stop listening</> : <><AudioLines className="h-4 w-4" /> Tap to speak</>}</button>
        <div className="mt-5"><label htmlFor="voice-destination" className="font-mono text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">Or type your destination</label><div className="mt-2 flex gap-2"><input id="voice-destination" value={destinationInput} onChange={(event) => setDestinationInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { void findRoute(destinationInput); setVoiceOpen(false); } }} placeholder="e.g. North Library" className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-xs outline-none ring-primary focus:ring-2" data-testid="input-voice-destination" /><button type="button" onClick={() => { void findRoute(destinationInput); setVoiceOpen(false); }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary" aria-label="Find typed destination" data-testid="button-submit-voice-destination"><ArrowUpRight className="h-4 w-4" /></button></div></div>
        <div className="mt-5 flex items-center gap-2 text-[10px] leading-4 text-muted-foreground"><PanelRightOpen className="h-3.5 w-3.5 shrink-0 text-primary" /> Your voice stays in this browser until you choose a destination.</div>
      </section>
    </main>
  );
}

function mapLocationFallback() {
  // Leaflet owns the map instance; this control remains intentionally lightweight
  // when the browser does not expose a geolocation position.
  if ('geolocation' in navigator) navigator.geolocation.getCurrentPosition(() => undefined, () => undefined);
}