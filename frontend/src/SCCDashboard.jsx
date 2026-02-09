import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Map,
  Activity,
  Truck,
  Zap,
  Moon,
  Sun,
  Radio,
  Users,
  Wifi,
  WifiOff,
  MapPin,
  ShieldAlert,
  Bell,
  X,
  LayoutGrid,
  Timer,
  Camera,
  EyeOff,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const DEMO_MODE = (import.meta.env.VITE_DEMO_MODE ?? 'true') === 'true';
const TIME_ZONE = import.meta.env.VITE_TIME_ZONE || 'Asia/Makassar';
const TIME_LABEL = import.meta.env.VITE_TIME_LABEL || 'WITA';
const UI_SCALE_ENV = import.meta.env.VITE_UI_SCALE;
const UI_SCALE_STORAGE_KEY = 'scc_ui_scale';
const SCALE_MIN = 0.8;
const SCALE_MAX = 1.6;
const SCALE_STEP = 0.05;

const buildApiUrl = (path) => {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
};

const SCCDashboard = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedArea, setSelectedArea] = useState('All');
  const [isSyncing, setIsSyncing] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [selectedRiskArea, setSelectedRiskArea] = useState(null);
  const [selectedRecurrentUnit, setSelectedRecurrentUnit] = useState(null);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState(null);
  const [showScaleControls, setShowScaleControls] = useState(false);

  const [alerts, setAlerts] = useState([]);
  const [deviceHealth, setDeviceHealth] = useState({
    total: 0,
    online: 0,
    offline: 0,
    coverage: 0
  });

  const fetchOverviewRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const lastErrorRef = useRef(0);
  const getStoredScale = () => {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(UI_SCALE_STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const getDefaultScale = useCallback(() => {
    if (typeof window === 'undefined') return 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width >= 2560 || height >= 1440) return 1.25;
    if (width >= 1920 || height >= 1080) return 1.15;
    return 1;
  }, []);

  const [uiScale, setUiScale] = useState(() => {
    const parsed = Number(UI_SCALE_ENV);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const stored = getStoredScale();
    if (stored) return stored;
    return getDefaultScale();
  });
  const [hasManualScale, setHasManualScale] = useState(() => {
    const parsed = Number(UI_SCALE_ENV);
    if (Number.isFinite(parsed) && parsed > 0) return true;
    return Boolean(getStoredScale());
  });

  useEffect(() => {
    if (hasManualScale) return;
    const handleResize = () => {
      setUiScale(getDefaultScale());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getDefaultScale, hasManualScale]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setShowScaleControls(false);
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 's') {
        setShowScaleControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  const seenAlertIdsRef = useRef(new Set());
  const seenAlertQueueRef = useRef([]);
  const hasSeededAlertsRef = useRef(false);

  // --- REFS UNTUK MENGUKUR TINGGI CONTAINER (DYNAMIC PAGINATION) ---
  const miningListContainerRef = useRef(null);
  const haulingListContainerRef = useRef(null);
  const activeFatigueListContainerRef = useRef(null);
  const recurrentListContainerRef = useRef(null);
  const highRiskListContainerRef = useRef(null);

  // --- PAGINATION STATES ---
  const [miningPage, setMiningPage] = useState(1);
  const [haulingPage, setHaulingPage] = useState(1);
  const [delayedPage, setDelayedPage] = useState(1);
  const [activeFatiguePage, setActiveFatiguePage] = useState(1);
  const [recurrentPage, setRecurrentPage] = useState(1);
  const [highRiskPage, setHighRiskPage] = useState(1);
  const [activeSortOrder, setActiveSortOrder] = useState('newest');
  const [recurrentSortOrder, setRecurrentSortOrder] = useState('newest');
  const [highRiskSortOrder, setHighRiskSortOrder] = useState('newest');

  // --- DYNAMIC ITEMS PER PAGE STATE ---
  const [dynamicItemsPerPage, setDynamicItemsPerPage] = useState({
    mining: 4,
    hauling: 4,
    activeFatigue: 6,
    recurrent: 3,
    highRisk: 3
  });

  const ITEMS_DELAYED = 5;

  const addNotification = useCallback((title, message, type = 'critical', meta = {}) => {
    if (DEMO_MODE) return;
    const id = Date.now() + Math.random();
    const newNotif = { id, title, message, type, ...meta };
    setNotifications((prev) => [newNotif, ...prev]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const playAlarm = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gainNode.gain.setValueAtTime(0.0001, context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);

      oscillator.connect(gainNode).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.6);
      oscillator.onended = () => context.close();
    } catch (error) {
      console.warn('Alarm sound blocked:', error);
    }
  }, []);

  const getAlertKey = useCallback((alert) => {
    if (!alert) return null;
    return (
      alert.id ||
      `${alert.sensorId || alert.unit || 'unknown'}|${alert.timestamp || alert.time || ''}`
    );
  }, []);

  const bumpScale = useCallback((delta) => {
    setUiScale((prev) => {
      const next = Math.max(SCALE_MIN, Math.min(SCALE_MAX, prev + delta));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(UI_SCALE_STORAGE_KEY, next.toFixed(2));
      }
      return next;
    });
    setHasManualScale(true);
  }, []);

  const resetScale = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(UI_SCALE_STORAGE_KEY);
    }
    setHasManualScale(false);
    setUiScale(getDefaultScale());
  }, [getDefaultScale]);

  const trackSeenAlert = useCallback((key) => {
    if (!key || seenAlertIdsRef.current.has(key)) return;
    seenAlertIdsRef.current.add(key);
    seenAlertQueueRef.current.push(key);
    if (seenAlertQueueRef.current.length > 1000) {
      const oldest = seenAlertQueueRef.current.shift();
      seenAlertIdsRef.current.delete(oldest);
    }
  }, []);

  useEffect(() => {
    const calculateCapacity = () => {
      const ITEM_HEIGHT_MINING_HAULING = 65;
      const ITEM_HEIGHT_ACTIVE_FATIGUE = 95;
      const ITEM_HEIGHT_RECURRENT = 50;
      const ITEM_HEIGHT_HIGH_RISK = 50;
      const PAGINATION_HEIGHT_BUFFER = 30;

      if (miningListContainerRef.current) {
        const height = miningListContainerRef.current.clientHeight;
        const availableHeight = height - PAGINATION_HEIGHT_BUFFER;
        const rows = Math.max(1, Math.floor(availableHeight / ITEM_HEIGHT_MINING_HAULING));
        setDynamicItemsPerPage((prev) => ({ ...prev, mining: rows * 2 }));
      }

      if (haulingListContainerRef.current) {
        const height = haulingListContainerRef.current.clientHeight;
        const availableHeight = height - PAGINATION_HEIGHT_BUFFER;
        const rows = Math.max(1, Math.floor(availableHeight / ITEM_HEIGHT_MINING_HAULING));
        setDynamicItemsPerPage((prev) => ({ ...prev, hauling: rows * 2 }));
      }

      if (activeFatigueListContainerRef.current) {
        const height = activeFatigueListContainerRef.current.clientHeight;
        const availableHeight = height - PAGINATION_HEIGHT_BUFFER;
        const rows = Math.max(1, Math.floor(availableHeight / ITEM_HEIGHT_ACTIVE_FATIGUE));
        setDynamicItemsPerPage((prev) => ({ ...prev, activeFatigue: rows }));
      }

      if (recurrentListContainerRef.current) {
        const height = recurrentListContainerRef.current.clientHeight;
        const availableHeight = height - PAGINATION_HEIGHT_BUFFER;
        const rows = Math.max(2, Math.floor(availableHeight / ITEM_HEIGHT_RECURRENT));
        setDynamicItemsPerPage((prev) => ({ ...prev, recurrent: rows }));
      }

      if (highRiskListContainerRef.current) {
        const height = highRiskListContainerRef.current.clientHeight;
        const availableHeight = height - PAGINATION_HEIGHT_BUFFER;
        const rows = Math.max(2, Math.floor(availableHeight / ITEM_HEIGHT_HIGH_RISK));
        setDynamicItemsPerPage((prev) => ({ ...prev, highRisk: rows }));
      }
    };

    calculateCapacity();
    window.addEventListener('resize', calculateCapacity);

    const timeoutId = setTimeout(calculateCapacity, 100);

    return () => {
      window.removeEventListener('resize', calculateCapacity);
      clearTimeout(timeoutId);
    };
  }, [selectedArea]);

  useEffect(() => {
    setMiningPage(1);
    setHaulingPage(1);
    setDelayedPage(1);
    setActiveFatiguePage(1);
    setRecurrentPage(1);
    setHighRiskPage(1);
    setSelectedRiskArea(null);
    setSelectedRecurrentUnit(null);
  }, [selectedArea, selectedLocationFilter]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (DEMO_MODE) {
      setIsSyncing(false);
      return;
    }
    let isMounted = true;

    const fetchOverview = async () => {
      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;
      setIsSyncing(true);

      try {
        const res = await fetch(buildApiUrl('/api/dashboard/overview'));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();

        if (!isMounted) return;
        const nextAlerts = Array.isArray(data.alerts) ? data.alerts : [];

        if (!hasSeededAlertsRef.current) {
          nextAlerts.forEach((alert) => trackSeenAlert(getAlertKey(alert)));
          hasSeededAlertsRef.current = true;
        } else {
          const newAlerts = [];
          nextAlerts.forEach((alert) => {
            const key = getAlertKey(alert);
            if (!key || seenAlertIdsRef.current.has(key)) return;
            newAlerts.push(alert);
            trackSeenAlert(key);
          });

          if (newAlerts.length > 0) {
            playAlarm();
          }

          newAlerts.slice(0, 5).forEach((alert) => {
            const fatigue = alert.fatigue || alert.type || 'Fatigue';
            const unit = alert.unit || alert.sensorId || 'Unknown Unit';
            const location = alert.location || 'Unknown Location';
            addNotification('New Fatigue Alert!', `${unit} • ${fatigue} • ${location}`, 'critical', {
              photoUrl: alert.photoUrl || null,
              alert
            });
          });
        }

        setAlerts(nextAlerts);
        if (data.deviceHealth) {
          setDeviceHealth(data.deviceHealth);
        }
      } catch (err) {
        const now = Date.now();
        if (now - lastErrorRef.current > 10000) {
          addNotification('API Error', 'Gagal mengambil data dashboard.');
          lastErrorRef.current = now;
        }
        console.error('Fetch overview error:', err);
      } finally {
        fetchInFlightRef.current = false;
        if (isMounted) setIsSyncing(false);
      }
    };

    fetchOverviewRef.current = fetchOverview;
    fetchOverview();

    const interval = setInterval(fetchOverview, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [addNotification, getAlertKey, playAlarm, trackSeenAlert]);

  useEffect(() => {
    if (!DEMO_MODE) return;

    const demoAlerts = [
      {
        id: '02590e78-01d2-4ef8-ae6e-4b3cee1d6c2e',
        unit: 'H489',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Eyes Closing',
        area: 'Mining',
        groupName: 'CSA 35',
        location: 'CSA 35',
        time: '20:42:06',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '56.07 km/h',
        count: 1,
        photoUrl:
          'https://mdvr.transtrack.id:36301/fileSrv/fileDown.php?filePath=RDovU2VydmVyTm9kZTEvRXZpZGVuY2UvaHRkb2NzL3Zzc0ZpbGVzL2hmdHAvUkVDLUFMQVJNLzIwMjYwMjAyLzg2NzM5NTA3ODgwNjQxNy8yMDQyMDZfNjUvMV82NF82NV8yXzE3NzAwNjQ5MjZfMC5qcGc%3D&ipaddr=34.124.162.30&dn=867395078806417_ch2_20260202204206_20260202204206__.jpg&token=7b0921ff0e66fe8912feec95f2717493',
        latitude: -2.290488,
        longitude: 114.920677
      },
      {
        id: 'followed-mining-1',
        unit: 'H516',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Eyes Closing',
        area: 'Mining',
        groupName: 'CSA 65',
        location: 'CSA 65',
        time: '10:12:00',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '64.21 km/h',
        count: 1
      },
      {
        id: 'followed-mining-2',
        unit: 'H353',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Eyes Closing',
        area: 'Mining',
        groupName: 'CSA 35',
        location: 'CSA 35',
        time: '09:18:15',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '51.20 km/h',
        count: 1
      },
      {
        id: 'followed-mining-3',
        unit: 'D3-737',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Yawning',
        area: 'Mining',
        groupName: 'Kerinci-Riau',
        location: 'Kerinci-Riau',
        time: '16:56:40',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '22.64 km/h',
        count: 1
      },
      {
        id: 'followed-hauling-1',
        unit: 'HD-777',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Eyes Closing',
        area: 'Hauling',
        groupName: 'Hauling Line A',
        location: 'Hauling Line A',
        time: '11:20:25',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '14.33 km/h',
        count: 1
      },
      {
        id: 'followed-hauling-2',
        unit: 'WT-05',
        operator: 'Unknown',
        type: 'Fatigue',
        fatigue: 'Yawning',
        area: 'Hauling',
        groupName: 'Hauling Line B',
        location: 'Hauling Line B',
        time: '12:28:16',
        date: '2026-02-02',
        status: 'Followed Up',
        speed: '15.59 km/h',
        count: 1
      }
    ];

    setAlerts(demoAlerts);
    setDeviceHealth({
      total: 6,
      online: 6,
      offline: 0,
      coverage: 100
    });
  }, []);

  const getOpenDurationValue = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(/[:.]/);
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2] || '0', 10);

    if (isNaN(h) || isNaN(m)) return 0;

    const eventTime = new Date();
    eventTime.setHours(h, m, s);

    const diffMs = currentTime - eventTime;
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins < 0 ? 0 : diffMins;
  };

  const getOpenDuration = (timeStr) => getOpenDurationValue(timeStr);

  const formatCoord = (value) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(6) : '-';

  const getAreaLabel = useCallback(
    (alert) => alert?.groupName || alert?.area || 'Unknown',
    []
  );

  const getAlertTimestamp = useCallback((alert) => {
    if (alert?.timestamp) {
      const parsed = new Date(alert.timestamp).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (alert?.date && alert?.time) {
      const parsed = new Date(`${alert.date}T${alert.time}`).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, []);

  const formatAlertDateTime = useCallback((alert) => {
    if (!alert) return '-';
    if (alert.date && alert.time) {
      return `${alert.date} ${alert.time}`;
    }
    if (alert.timestamp) {
      const parsed = new Date(alert.timestamp);
      if (Number.isNaN(parsed.getTime())) return '-';
      return parsed.toLocaleString('id-ID', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }
    return alert.time || '-';
  }, []);

  const formatGapMinutes = useCallback((minutes) => {
    if (!Number.isFinite(minutes)) return '-';
    if (minutes >= 60) return `${(minutes / 60).toFixed(1)} hr`;
    return `${minutes.toFixed(1)} min`;
  }, []);

  const demoTimeString = useMemo(() => {
    if (!DEMO_MODE) return null;
    const demoDate = new Date(currentTime.getTime() - 10 * 60 * 1000);
    return demoDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: TIME_ZONE
    });
  }, [currentTime]);

  const handleSelectAlert = useCallback(
    (alert) => {
      if (DEMO_MODE) {
        setSelectedAlert(alerts[0] || alert);
        return;
      }
      setSelectedAlert(alert);
    },
    [alerts]
  );

  const filteredAlertsByArea = useMemo(() => {
    return selectedArea === 'All'
      ? alerts
      : alerts.filter((a) => a.area === selectedArea);
  }, [alerts, selectedArea]);

  const highRiskOperators = useMemo(() => {
    if (DEMO_MODE) return [];
    const unitMap = {};
    filteredAlertsByArea.forEach((alert) => {
      const unitKey = alert.unit || alert.sensorId || 'Unknown Unit';
      if (!unitMap[unitKey]) {
        unitMap[unitKey] = {
          unit: unitKey,
          operator: alert.operator,
          events: 0,
          maxFollowedUpAt: null,
          maxOpenAt: null,
          lastSeenAt: null
        };
      }
      const entry = unitMap[unitKey];
      entry.events += alert.count || 1;
      const ts = getAlertTimestamp(alert);
      entry.lastSeenAt = Math.max(entry.lastSeenAt ?? 0, ts);
      if (alert.status === 'Followed Up') {
        entry.maxFollowedUpAt = Math.max(entry.maxFollowedUpAt ?? 0, ts);
      }
      if (alert.status === 'Open') {
        entry.maxOpenAt = Math.max(entry.maxOpenAt ?? 0, ts);
      }
    });

    return Object.values(unitMap)
      .filter(
        (entry) =>
          entry.maxFollowedUpAt &&
          entry.maxOpenAt &&
          entry.maxOpenAt > entry.maxFollowedUpAt
      )
      .map((entry) => ({
        name: entry.operator || 'Unknown Driver',
        unit: entry.unit,
        events: entry.events,
        status: 'Active',
        lastSeenAt: entry.lastSeenAt || 0
      }))
      .sort((a, b) => {
        if (recurrentSortOrder === 'oldest') {
          return a.lastSeenAt - b.lastSeenAt;
        }
        return b.lastSeenAt - a.lastSeenAt;
      });
  }, [filteredAlertsByArea, getAlertTimestamp, recurrentSortOrder]);

  const highFreqZones = useMemo(() => {
    if (DEMO_MODE) return [];
    const zoneMap = {};
    filteredAlertsByArea.forEach((a) => {
      const areaLabel = getAreaLabel(a);
      if (!zoneMap[areaLabel]) {
        zoneMap[areaLabel] = {
          location: areaLabel,
          count: 0,
          area: a.area,
          lastSeenAt: 0
        };
      }
      zoneMap[areaLabel].count += 1;
      zoneMap[areaLabel].lastSeenAt = Math.max(
        zoneMap[areaLabel].lastSeenAt,
        getAlertTimestamp(a)
      );
    });

    return Object.values(zoneMap).sort((a, b) => {
      if (highRiskSortOrder === 'oldest') {
        return a.lastSeenAt - b.lastSeenAt;
      }
      return b.lastSeenAt - a.lastSeenAt;
    });
  }, [filteredAlertsByArea, getAreaLabel, getAlertTimestamp, highRiskSortOrder]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      if (selectedLocationFilter) {
        const areaLabel = getAreaLabel(alert);
        return areaLabel === selectedLocationFilter && alert.status === 'Open';
      }
      const areaMatch = selectedArea === 'All' || alert.area === selectedArea;
      const statusMatch = alert.status === 'Open';
      return areaMatch && statusMatch;
    });
  }, [alerts, selectedArea, selectedLocationFilter, getAreaLabel]);

  const sortedActiveAlerts = useMemo(() => {
    const copy = [...filteredAlerts];
    copy.sort((a, b) => {
      const aTime = getAlertTimestamp(a);
      const bTime = getAlertTimestamp(b);
      if (activeSortOrder === 'oldest') {
        return aTime - bTime;
      }
      return bTime - aTime;
    });
    return copy;
  }, [filteredAlerts, getAlertTimestamp, activeSortOrder]);

  const selectedRiskAreaSummary = useMemo(() => {
    if (!selectedRiskArea) return null;
    const areaAlerts = filteredAlertsByArea.filter(
      (alert) => getAreaLabel(alert) === selectedRiskArea
    );
    const totalEvents = areaAlerts.reduce(
      (sum, alert) => sum + (Number(alert.count) || 1),
      0
    );
    const openCount = areaAlerts.filter((alert) => alert.status === 'Open')
      .length;
    const followedUpCount = areaAlerts.filter(
      (alert) => alert.status === 'Followed Up'
    ).length;
    const waitingCount = areaAlerts.filter(
      (alert) => alert.status !== 'Followed Up'
    ).length;
    const sortedByTime = [...areaAlerts].sort(
      (a, b) => getAlertTimestamp(b) - getAlertTimestamp(a)
    );
    const newestAlert = sortedByTime[0] || null;
    const oldestAlert = sortedByTime[sortedByTime.length - 1] || null;
    const distinctUnits = new Set(
      areaAlerts.map((alert) => alert.unit || alert.sensorId || 'Unknown')
    ).size;
    const unitCounts = {};
    areaAlerts.forEach((alert) => {
      const key = alert.unit || alert.sensorId || 'Unknown';
      unitCounts[key] = (unitCounts[key] || 0) + (Number(alert.count) || 1);
    });
    const topUnits = Object.entries(unitCounts)
      .map(([unit, count]) => ({ unit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      area: selectedRiskArea,
      totalEvents,
      openCount,
      followedUpCount,
      waitingCount,
      newestAlert,
      oldestAlert,
      distinctUnits,
      topUnits
    };
  }, [selectedRiskArea, filteredAlertsByArea, getAreaLabel, getAlertTimestamp]);

  const selectedRecurrentSummary = useMemo(() => {
    if (!selectedRecurrentUnit) return null;
    const unitAlerts = filteredAlertsByArea.filter((alert) => {
      const unitKey = alert.unit || alert.sensorId || 'Unknown';
      return unitKey === selectedRecurrentUnit;
    });
    const totalEvents = unitAlerts.reduce(
      (sum, alert) => sum + (Number(alert.count) || 1),
      0
    );
    const alertsWithTs = unitAlerts
      .map((alert) => ({ alert, ts: getAlertTimestamp(alert) }))
      .filter((item) => Number.isFinite(item.ts) && item.ts > 0)
      .sort((a, b) => a.ts - b.ts);
    const oldestAlert = alertsWithTs[0]?.alert || null;
    const newestAlert = alertsWithTs.length
      ? alertsWithTs[alertsWithTs.length - 1].alert
      : null;
    const lastAlert = newestAlert || null;
    const lastStatus = lastAlert?.status || 'Unknown';

    const fatigueCounts = {};
    unitAlerts.forEach((alert) => {
      const fatigue = alert.fatigue || alert.type || 'Fatigue';
      fatigueCounts[fatigue] =
        (fatigueCounts[fatigue] || 0) + (Number(alert.count) || 1);
    });
    const dominantFatigue = Object.entries(fatigueCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([fatigue]) => fatigue)[0] || 'Fatigue';

    const sortedAsc = [...unitAlerts].sort(
      (a, b) => getAlertTimestamp(a) - getAlertTimestamp(b)
    );
    let recurrenceCount = 0;
    let lastSeenStatus = null;
    sortedAsc.forEach((alert) => {
      const status = alert.status || 'Open';
      if (lastSeenStatus === 'Followed Up' && status === 'Open') {
        recurrenceCount += 1;
      }
      lastSeenStatus = status;
    });
    let avgGapMinutes = null;
    if (alertsWithTs.length > 1) {
      let totalGap = 0;
      for (let i = 1; i < alertsWithTs.length; i += 1) {
        totalGap += (alertsWithTs[i].ts - alertsWithTs[i - 1].ts) / 60000;
      }
      avgGapMinutes = totalGap / (alertsWithTs.length - 1);
    }

    return {
      unit: selectedRecurrentUnit,
      totalEvents,
      lastStatus,
      lastAlert,
      oldestAlert,
      avgGapMinutes,
      dominantFatigue,
      recurrenceCount
    };
  }, [selectedRecurrentUnit, filteredAlertsByArea, getAlertTimestamp]);

  const overdueAlerts = useMemo(() => {
    if (DEMO_MODE) return [];
    return filteredAlertsByArea.filter((alert) => {
      return alert.status === 'Open' && getOpenDurationValue(alert.time) > 30;
    });
  }, [filteredAlertsByArea, currentTime]);

  const areaSummary = useMemo(() => {
    const summary = {
      Mining: { open: 0, resolved: 0, total: 0 },
      Hauling: { open: 0, resolved: 0, total: 0 }
    };

    alerts.forEach((alert) => {
      if (summary[alert.area]) {
        summary[alert.area].total += 1;
        if (alert.status === 'Open') {
          summary[alert.area].open += 1;
        } else if (alert.status === 'Followed Up') {
          summary[alert.area].resolved += 1;
        }
      }
    });

    return summary;
  }, [alerts]);

  const locationStats = useMemo(() => {
    const stats = { Mining: {}, Hauling: {} };
    const openAlerts = alerts.filter((a) => a.status === 'Open');

    openAlerts.forEach((alert) => {
      if (stats[alert.area]) {
        const areaLabel = getAreaLabel(alert);
        if (!stats[alert.area][areaLabel]) {
          stats[alert.area][areaLabel] = 0;
        }
        stats[alert.area][areaLabel]++;
      }
    });
    return stats;
  }, [alerts, getAreaLabel]);

  const stats = useMemo(() => {
    const baseData = filteredAlertsByArea;

    const totalToday = baseData.length;
    const activeOpen = baseData.filter((a) => a.status === 'Open').length;
    const followedUpToday = baseData.filter((a) => a.status === 'Followed Up').length;
    return { totalToday, followedUpToday, activeOpen };
  }, [filteredAlertsByArea]);


  const handleAreaTabClick = (area) => {
    setSelectedArea(area);
    setSelectedLocationFilter(null);
  };

  const paginate = (data, page, limit) => {
    const start = (page - 1) * limit;
    return data.slice(start, start + limit);
  };

  const PaginationControls = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
      <div
        className={`flex items-center justify-end gap-2 mt-auto pt-1 border-t border-dashed ${
          darkMode ? 'border-slate-700' : 'border-slate-300'
        }`}
      >
        <span
          className={`text-[8px] lg:text-[9px] ${
            darkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Pg {currentPage}/{totalPages}
        </span>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPageChange(Math.max(1, currentPage - 1));
            }}
            disabled={currentPage === 1}
            className={`p-0.5 rounded hover:bg-slate-700 disabled:opacity-30 ${
              darkMode ? 'text-white' : 'text-slate-800'
            }`}
          >
            <ChevronLeft size={10} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPageChange(Math.min(totalPages, currentPage + 1));
            }}
            disabled={currentPage === totalPages}
            className={`p-0.5 rounded hover:bg-slate-700 disabled:opacity-30 ${
              darkMode ? 'text-white' : 'text-slate-800'
            }`}
          >
            <ChevronRight size={10} />
          </button>
        </div>
      </div>
    );
  };

  const getCardBg = () =>
    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-300 shadow-sm';
  const getBodyBg = () => (darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-200 text-slate-800');

  const getAreaTitle = () => (selectedArea === 'All' ? '' : `${selectedArea.toUpperCase()} `);

  return (
    <div
      className={`dashboard-scale h-screen w-screen transition-colors duration-300 font-sans ${getBodyBg()} flex flex-col overflow-hidden relative selection:bg-red-500/30`}
      style={{ '--ui-scale': uiScale }}
    >
      {/* --- NOTIFICATIONS STACK CONTAINER --- */}
      <div className="absolute top-[10vh] right-[2vw] z-[100] flex flex-col gap-2 pointer-events-none max-w-[400px] w-[25vw]">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => {
              if (notif.alert) {
                setSelectedAlert(notif.alert);
                removeNotification(notif.id);
              }
            }}
            className={`pointer-events-auto p-[1.5vh] rounded-lg shadow-2xl border-l-4 flex items-start gap-3 w-full animate-in slide-in-from-right duration-300 ${
              darkMode ? 'bg-slate-800 border-red-500 text-white' : 'bg-white border-red-500 text-slate-800'
            }`}
          >
            <div className="shrink-0">
              {notif.photoUrl ? (
                <img
                  src={notif.photoUrl}
                  alt="Alert"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded object-cover border border-red-500/40"
                />
              ) : (
                <div className="p-2 bg-red-500/20 rounded-full text-red-500 animate-pulse">
                  <Bell size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">{notif.title}</h4>
              <p className="text-xs opacity-80 mt-1 break-words">{notif.message}</p>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                removeNotification(notif.id);
              }}
              className="text-slate-500 hover:text-red-500 shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* --- MODAL DETAIL HIGH RISK AREA --- */}
      {selectedRiskArea && selectedRiskAreaSummary && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-[85vw] lg:max-w-[70vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
              darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-slate-100 text-slate-900'
            }`}
          >
            <div className="p-[2vh] lg:p-[3vh] border-b border-inherit flex justify-between items-start shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
                    <span className="bg-orange-500 text-white p-1.5 rounded">
                      <MapPin size={28} />
                    </span>
                    HIGH RISK AREA DETAIL
                  </h2>
                  <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-bold border border-orange-200 uppercase tracking-wider">
                    {selectedRiskAreaSummary.area}
                  </span>
                </div>
                <p className="opacity-70 text-lg lg:text-xl">
                  Total Events:{' '}
                  <span className="font-mono font-bold text-orange-500">
                    {selectedRiskAreaSummary.totalEvents}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedRiskArea(null)}
                className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
              >
                <X size={32} />
              </button>
            </div>

            <div className="p-[2vh] lg:p-[3vh] grid grid-cols-1 gap-[2vh]">
              {selectedRiskAreaSummary.totalEvents === 0 ? (
                <div className="flex items-center justify-center text-slate-500 text-lg">
                  No data available for this area.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-[1.5vh]">
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Open</div>
                      <div className="text-2xl font-bold text-red-500">
                        {selectedRiskAreaSummary.openCount}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Followed Up</div>
                      <div className="text-2xl font-bold text-emerald-500">
                        {selectedRiskAreaSummary.followedUpCount}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Waiting Follow Up</div>
                      <div className="text-2xl font-bold text-amber-500">
                        {selectedRiskAreaSummary.waitingCount}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1.5vh]">
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Last Alert Time</div>
                      <div className="text-lg font-mono font-semibold text-blue-400">
                        {formatAlertDateTime(selectedRiskAreaSummary.newestAlert)}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Oldest Alert Time</div>
                      <div className="text-lg font-mono font-semibold text-blue-400">
                        {formatAlertDateTime(selectedRiskAreaSummary.oldestAlert)}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-[1.5vh] rounded-xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="text-xs opacity-60 uppercase tracking-wider">Affected Units</div>
                    <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                      {selectedRiskAreaSummary.distinctUnits}
                    </div>
                  </div>

                  <div
                    className={`p-[1.5vh] rounded-xl border ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className="text-xs opacity-60 uppercase tracking-wider">Top Units</div>
                    {selectedRiskAreaSummary.topUnits.length === 0 ? (
                      <div className="text-sm text-slate-500 mt-2">No unit data</div>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {selectedRiskAreaSummary.topUnits.map((entry) => (
                          <div key={entry.unit} className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{entry.unit}</span>
                            <span className="font-mono text-orange-500">{entry.count}x</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DETAIL RECURRENT UNIT --- */}
      {selectedRecurrentUnit && selectedRecurrentSummary && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-[85vw] lg:max-w-[70vw] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
              darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-slate-100 text-slate-900'
            }`}
          >
            <div className="p-[2vh] lg:p-[3vh] border-b border-inherit flex justify-between items-start shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
                    <span className="bg-red-500 text-white p-1.5 rounded">
                      <Users size={28} />
                    </span>
                    RECURRENT UNIT DETAIL
                  </h2>
                  <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-bold border border-red-200 uppercase tracking-wider">
                    {selectedRecurrentSummary.unit}
                  </span>
                </div>
                <p className="opacity-70 text-lg lg:text-xl">
                  Total Events Today:{' '}
                  <span className="font-mono font-bold text-red-400">
                    {selectedRecurrentSummary.totalEvents}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedRecurrentUnit(null)}
                className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
              >
                <X size={32} />
              </button>
            </div>

            <div className="p-[2vh] lg:p-[3vh] grid grid-cols-1 gap-[2vh]">
              {selectedRecurrentSummary.totalEvents === 0 ? (
                <div className="flex items-center justify-center text-slate-500 text-lg">
                  No data available for this unit.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1.5vh]">
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Last Status</div>
                      <div className={`text-2xl font-bold ${selectedRecurrentSummary.lastStatus === 'Followed Up' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {selectedRecurrentSummary.lastStatus}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Last Alert Time</div>
                      <div className="text-lg font-mono font-semibold text-blue-400">
                        {formatAlertDateTime(selectedRecurrentSummary.lastAlert)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1.5vh]">
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Oldest Alert Time</div>
                      <div className="text-lg font-mono font-semibold text-blue-400">
                        {formatAlertDateTime(selectedRecurrentSummary.oldestAlert)}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Average Time Gap</div>
                      <div className="text-2xl font-bold text-amber-500">
                        {formatGapMinutes(selectedRecurrentSummary.avgGapMinutes)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[1.5vh]">
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">Dominant Fatigue Type</div>
                      <div className="text-2xl font-bold text-orange-500">
                        {selectedRecurrentSummary.dominantFatigue}
                      </div>
                    </div>
                    <div
                      className={`p-[1.5vh] rounded-xl border ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className="text-xs opacity-60 uppercase tracking-wider">
                        Open After Followed Up
                      </div>
                      <div className="text-2xl font-bold text-red-400">
                        {selectedRecurrentSummary.recurrenceCount}x
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DETAIL ALERT --- */}
      {selectedAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className={`w-full max-w-[90vw] h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
              darkMode ? 'bg-slate-900 text-white border border-slate-700' : 'bg-slate-100 text-slate-900'
            }`}
          >
            {/* Header */}
            <div className="p-[2vh] lg:p-[3vh] border-b border-inherit flex justify-between items-start shrink-0">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
                    <span className="bg-red-500 text-white p-1.5 rounded">
                      <AlertTriangle size={28} />
                    </span>
                    FATIGUE ALERT DETAIL
                  </h2>
                  <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-bold border border-red-200 uppercase tracking-wider">
                    {selectedAlert.status}
                  </span>
                </div>
                <p className="opacity-70 text-lg lg:text-xl">
                  Unit{' '}
                  <span className="font-mono font-bold bg-slate-700 text-white px-2 py-0.5 rounded mx-1">
                    {selectedAlert.unit}
                  </span>
                  operated by <strong className="text-red-400">{selectedAlert.operator}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-2 hover:bg-slate-700/50 rounded-full transition-colors"
              >
                <X size={32} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-[2vh] lg:p-[3vh] overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[3vh] h-full">
                {/* LEFT */}
                <div className="flex flex-col gap-[2vh] h-full">
                  <h3 className="font-bold text-sm uppercase tracking-wider opacity-70 flex items-center gap-2 shrink-0">
                    <Camera size={18} /> In-Cabin Camera Feed
                  </h3>
                  <div className="flex-1 relative rounded-xl bg-black border-2 border-slate-700 overflow-hidden group">
                    {selectedAlert.photoUrl ? (
                      <img
                        src={selectedAlert.photoUrl}
                        alt="Fatigue capture"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover z-0"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs z-0">
                        No photo
                      </div>
                    )}
                    <div className="absolute inset-0 bg-green-900/10 z-10 pointer-events-none mix-blend-overlay"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,#000_100%)] z-20 pointer-events-none"></div>
                    <div className="absolute top-[25%] left-[30%] right-[30%] bottom-[25%] border-4 border-red-500/80 rounded-lg z-30 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse flex flex-col items-center justify-end pb-4">
                      <div className="bg-red-600 text-white text-sm lg:text-base font-bold px-3 py-1.5 rounded flex items-center gap-2 shadow-lg">
                        <EyeOff size={16} /> EYES CLOSED (2.5s)
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 shrink-0 h-[10vh] min-h-[80px]">
                    <div
                      className={`p-4 rounded border flex flex-col justify-center ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <span className="text-xs opacity-60 block uppercase tracking-wider">Vehicle Speed</span>
                      <span className="font-mono font-bold text-2xl lg:text-3xl">{selectedAlert.speed}</span>
                    </div>
                    <div
                      className={`p-4 rounded border flex flex-col justify-center ${
                        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    >
                      <span className="text-xs opacity-60 block uppercase tracking-wider">Fatigue Type</span>
                      <span className="font-bold text-2xl lg:text-3xl text-red-500">
                        {selectedAlert.fatigue || selectedAlert.type || 'Fatigue'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* RIGHT */}
                <div className="flex flex-col gap-[2vh] h-full">
                  <h3 className="font-bold text-sm uppercase tracking-wider opacity-70 flex items-center gap-2 shrink-0">
                    <Map size={18} /> Event Location
                  </h3>
                  <div
                    className={`flex-1 relative rounded-xl border border-slate-600 overflow-hidden ${
                      darkMode ? 'bg-slate-800' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `linear-gradient(${darkMode ? '#fff' : '#000'} 1px, transparent 1px), linear-gradient(90deg, ${
                          darkMode ? '#fff' : '#000'
                        } 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                      }}
                    ></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
                      <div className="w-20 h-20 rounded-full bg-red-500/20 animate-ping absolute top-0"></div>
                      <div className="relative z-10 text-red-600 drop-shadow-xl transform group-hover:-translate-y-2 transition-transform">
                        <MapPin size={64} fill={darkMode ? '#ef4444' : '#dc2626'} className="text-white" />
                      </div>
                      <div className="mt-2 bg-slate-900 text-white text-sm px-3 py-1.5 rounded shadow-lg font-bold whitespace-nowrap z-20">
                        {selectedAlert.location}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`p-4 rounded border shrink-0 flex items-center justify-between ${
                      darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs opacity-60 block">GPS Coordinates</span>
                      <span className="font-mono text-base font-medium text-blue-500">
                        Lat: {formatCoord(selectedAlert.latitude)}, Long: {formatCoord(selectedAlert.longitude)}
                      </span>
                      <div className="text-xs opacity-50 mt-1">Accuracy: ±2m</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER (Fixed Height: 7vh) --- */}
      <header
        className={`h-[7vh] min-h-[50px] border-b flex items-center justify-between px-[2vw] shrink-0 ${
          darkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="hidden lg:block border-r pr-6 mr-2 border-inherit">
            <img
              src="https://via.placeholder.com/200x60/334155/ffffff?text=YOUR+LOGO"
              alt="Company Logo"
              className="h-[3.5vh] min-h-[24px] object-contain"
            />
          </div>
          <div className="p-2 bg-red-600 rounded-lg shadow-lg shadow-red-500/30">
            <ShieldAlert className="w-[2.5vh] h-[2.5vh] text-white" />
          </div>
          <div>
            <h1 className="text-[clamp(1rem,1.4vh,1.4rem)] font-bold tracking-tight leading-tight">
              FATIGUE COMMAND CENTER
            </h1>
            <p className={`text-[clamp(0.6rem,0.9vh,0.9rem)] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Operational Monitoring Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-[2vw]">

          <div
            className={`hidden md:flex items-center gap-4 px-[1.5vw] py-[0.6vh] rounded-full border ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${deviceHealth.offline === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
              <span className="text-[clamp(0.6rem,0.9vh,0.9rem)] font-semibold whitespace-nowrap">
                Sensor Health: {deviceHealth.coverage}%
              </span>
            </div>
            <div className="h-3 w-px bg-slate-600/30"></div>
            <div className="flex items-center gap-3 text-[clamp(0.6rem,0.9vh,0.9rem)]">
              <div className="flex items-center gap-1">
                <Wifi className="w-[1.8vh] h-[1.8vh] text-emerald-500" />{' '}
                <span className="font-mono">{deviceHealth.online}</span>
              </div>
              <div className="flex items-center gap-1">
                <WifiOff className="w-[1.8vh] h-[1.8vh] text-red-500 ml-1" />{' '}
                <span className="font-mono">{deviceHealth.offline}</span>
              </div>
            </div>
          </div>

          <div
            onDoubleClick={() => setShowScaleControls((prev) => !prev)}
            className={`flex flex-col items-end relative ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}
          >
            <span className="text-[clamp(1rem,2vh,1.8rem)] font-mono font-semibold leading-none">
              {currentTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: TIME_ZONE
              })}{' '}
              {TIME_LABEL}
            </span>
            <span className="text-[clamp(0.6rem,0.9vh,0.9rem)] font-medium uppercase tracking-wider mt-0.5">
              {currentTime.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: TIME_ZONE
              })}
            </span>
            {showScaleControls && (
              <div
                onClick={(event) => event.stopPropagation()}
                className={`absolute top-full right-0 mt-2 z-[120] rounded-lg border px-3 py-2 shadow-xl ${
                  darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bumpScale(-SCALE_STEP)}
                    disabled={uiScale <= SCALE_MIN + 0.001}
                    className={`h-7 w-7 rounded font-bold ${
                      darkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                    } ${uiScale <= SCALE_MIN + 0.001 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-700/50'}`}
                  >
                    -
                  </button>
                  <span className="text-xs font-mono">{Math.round(uiScale * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => bumpScale(SCALE_STEP)}
                    disabled={uiScale >= SCALE_MAX - 0.001}
                    className={`h-7 w-7 rounded font-bold ${
                      darkMode ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                    } ${uiScale >= SCALE_MAX - 0.001 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-700/50'}`}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={resetScale}
                  className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${
                    darkMode ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Auto
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-[0.8vh] rounded-full transition-colors ${
              darkMode ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' : 'bg-slate-300 hover:bg-slate-400 text-slate-700'
            }`}
          >
            {darkMode ? <Sun className="w-[2.5vh] h-[2.5vh]" /> : <Moon className="w-[2.5vh] h-[2.5vh]" />}
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex p-[1.5vh] gap-[1.5vh] overflow-hidden min-h-0">
        {/* --- LEFT PANEL & MIDDLE (Flex-4) --- */}
        <div className="flex-[4] flex flex-col gap-[1.5vh] min-w-0 h-full">
          {/* 1. KPI CARDS */}
          <div className="grid grid-cols-3 gap-[1.5vh] shrink-0 h-[14vh] min-h-[90px]">
            <div className={`p-[1.5vh] rounded-xl border flex items-center justify-between ${getCardBg()}`}>
              <div className="flex flex-col justify-center h-full">
                <p
                  className={`text-[clamp(0.6rem,0.9vh,0.8rem)] uppercase font-bold tracking-wider mb-1 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {selectedArea === 'All' ? 'TOTAL' : selectedArea.toUpperCase()} ALARMS
                </p>
                <h2
                  className={`text-[clamp(1.8rem,3vh,2.5rem)] font-bold leading-tight ${
                    darkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {stats.totalToday}
                </h2>
              </div>
              <div className={`p-[1vh] rounded-full ${darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                <Radio className="w-[2.5vh] h-[2.5vh]" />
              </div>
            </div>

            <div className={`p-[1.5vh] rounded-xl border flex items-center justify-between ${getCardBg()}`}>
              <div className="flex flex-col justify-center h-full">
                <p
                  className={`text-[clamp(0.6rem,0.9vh,0.8rem)] uppercase font-bold tracking-wider mb-1 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {getAreaTitle()}FOLLOWED UP
                </p>
                <h2 className="text-[clamp(1.8rem,3vh,2.5rem)] font-bold leading-tight text-emerald-500">
                  {stats.followedUpToday}
                </h2>
              </div>
              <div className={`p-[1vh] rounded-full ${darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                <CheckCircle className="w-[2.5vh] h-[2.5vh]" />
              </div>
            </div>

            <div
              className={`p-[1.5vh] rounded-xl border flex items-center justify-between relative overflow-hidden ${
                darkMode ? 'bg-red-900/20 border-red-500/50' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="z-10 flex flex-col justify-center h-full">
                <p className="text-[clamp(0.6rem,0.9vh,0.8rem)] uppercase font-bold tracking-wider text-red-500 mb-1">
                  {getAreaTitle()}WAITING FOLLOW UP
                </p>
                <h2 className="text-[clamp(2.2rem,3.5vh,3.5rem)] font-black leading-tight text-red-600">
                  {stats.activeOpen}
                </h2>
              </div>
              <div className="p-[1vh] rounded-full bg-red-500 text-white animate-pulse z-10">
                <AlertTriangle className="w-[3vh] h-[3vh]" />
              </div>
              <div className="absolute -right-4 -bottom-4 w-[12vh] h-[12vh] bg-red-500/10 rounded-full blur-xl"></div>
            </div>
          </div>

          {/* 2. MIDDLE AREA */}
          <div className="flex-[2] flex gap-[1.5vh] min-h-0">
            {/* AREA DISTRIBUTION */}
            <div className={`flex-[1.8] rounded-xl border flex flex-col p-[1.5vh] overflow-hidden ${getCardBg()}`}>
              <div className="flex items-center mb-[1vh] shrink-0">
                <div
                  className={`px-3 py-1 rounded-md text-[clamp(0.65rem,1vh,0.9rem)] font-bold flex items-center gap-2 ${
                    darkMode ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-800 shadow-sm border border-slate-200'
                  }`}
                >
                  <LayoutGrid size={14} /> {selectedArea === 'All' ? 'AREA' : selectedArea.toUpperCase()} DISTRIBUTION
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-1"></span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col">
                <div className={`grid gap-[1vh] h-full ${selectedArea === 'All' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {(selectedArea === 'All' || selectedArea === 'Mining') && (
                    <div className={`rounded-lg p-[1vh] flex flex-col h-full ${darkMode ? 'bg-slate-900/40' : 'bg-white/60 border border-slate-200'}`}>
                      <div className={`flex items-center justify-between mb-1 border-b pb-1 shrink-0 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase flex items-center gap-2 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                          <Activity size={14} /> Mining
                        </h3>
                        <div className="flex items-center gap-2 text-[9px] lg:text-[10px]">
                          <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{areaSummary.Mining.total} Total</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-red-500 font-bold">{areaSummary.Mining.open} Open</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-emerald-500 font-bold">{areaSummary.Mining.resolved} Fixed</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between overflow-hidden" ref={miningListContainerRef}>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {Object.keys(locationStats.Mining).length > 0 ? (
                            paginate(Object.entries(locationStats.Mining), miningPage, dynamicItemsPerPage.mining).map(([areaLabel, count]) => (
                              <div
                                key={areaLabel}
                                onClick={() => {
                                  setSelectedArea('Mining');
                                  setSelectedLocationFilter(areaLabel);
                                }}
                                className={`p-1.5 rounded border flex flex-col justify-between items-center text-center transition-all cursor-pointer hover:scale-105 ${
                                  selectedLocationFilter === areaLabel
                                    ? darkMode
                                      ? 'bg-blue-900/40 border-blue-400 ring-1 ring-blue-500'
                                      : 'bg-blue-50 border-blue-500 ring-1 ring-blue-200'
                                    : darkMode
                                      ? 'bg-slate-800 border-slate-600 hover:border-slate-500'
                                      : 'bg-white border-slate-200 shadow-sm hover:border-blue-300'
                                }`}
                              >
                                <span className={`text-[9px] font-medium mb-0.5 line-clamp-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{areaLabel}</span>
                                <span className="text-lg font-black text-red-500 leading-none">{count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 py-4 text-center text-slate-500 text-xs italic">No active alerts</div>
                          )}
                        </div>
                        <PaginationControls currentPage={miningPage} totalPages={Math.ceil(Object.keys(locationStats.Mining).length / dynamicItemsPerPage.mining)} onPageChange={setMiningPage} />
                      </div>
                    </div>
                  )}

                  {(selectedArea === 'All' || selectedArea === 'Hauling') && (
                    <div className={`rounded-lg p-[1vh] flex flex-col h-full ${darkMode ? 'bg-slate-900/40' : 'bg-white/60 border border-slate-200'}`}>
                      <div className={`flex items-center justify-between mb-1 border-b pb-1 shrink-0 ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                        <h3 className={`text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase flex items-center gap-2 ${darkMode ? 'text-teal-400' : 'text-teal-600'}`}>
                          <Truck size={14} /> Hauling
                        </h3>
                        <div className="flex items-center gap-2 text-[9px] lg:text-[10px]">
                          <span className={darkMode ? 'text-slate-400' : 'text-slate-600'}>{areaSummary.Hauling.total} Total</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-red-500 font-bold">{areaSummary.Hauling.open} Open</span>
                          <span className="text-slate-500">|</span>
                          <span className="text-emerald-500 font-bold">{areaSummary.Hauling.resolved} Fixed</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between overflow-hidden" ref={haulingListContainerRef}>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {Object.keys(locationStats.Hauling).length > 0 ? (
                            paginate(Object.entries(locationStats.Hauling), haulingPage, dynamicItemsPerPage.hauling).map(([areaLabel, count]) => (
                              <div
                                key={areaLabel}
                                onClick={() => {
                                  setSelectedArea('Hauling');
                                  setSelectedLocationFilter(areaLabel);
                                }}
                                className={`p-1.5 rounded border flex flex-col justify-between items-center text-center transition-all cursor-pointer hover:scale-105 ${
                                  selectedLocationFilter === areaLabel
                                    ? darkMode
                                      ? 'bg-teal-900/40 border-teal-400 ring-1 ring-teal-500'
                                      : 'bg-teal-50 border-teal-500 ring-1 ring-teal-200'
                                    : darkMode
                                      ? 'bg-slate-800 border-slate-600 hover:border-slate-500'
                                      : 'bg-white border-slate-200 shadow-sm hover:border-teal-300'
                                }`}
                              >
                                <span className={`text-[9px] font-medium mb-0.5 line-clamp-1 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{areaLabel}</span>
                                <span className="text-lg font-black text-red-500 leading-none">{count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 py-4 text-center text-slate-500 text-xs italic">No active alerts</div>
                          )}
                        </div>
                        <PaginationControls currentPage={haulingPage} totalPages={Math.ceil(Object.keys(locationStats.Hauling).length / dynamicItemsPerPage.hauling)} onPageChange={setHaulingPage} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DELAYED FOLLOW UP (Paginated) */}
            <div className={`flex-1 rounded-xl border-2 flex flex-col p-[1.5vh] overflow-hidden ${darkMode ? 'bg-red-900/10 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-red-50 border-red-600 shadow-md'}`}>
              <div className="flex justify-between items-center mb-[1vh] shrink-0 border-b pb-2 border-inherit">
                <div className="flex items-center gap-2">
                  <h3 className="text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase flex items-center gap-2 text-red-500 animate-pulse">
                    <Timer size={16} /> DELAYED FOLLOW UP
                  </h3>
                  <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">{'>'} 30 Min</span>
                </div>
                <span className={`text-[10px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  <span className="text-red-500 text-sm mr-1">{overdueAlerts.length}</span>Total
                </span>
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-hidden">
                <div className="flex-1 space-y-1.5 overflow-hidden">
                  {overdueAlerts.length > 0 ? (
                    paginate(overdueAlerts, delayedPage, ITEMS_DELAYED).map((alert) => (
                      <div
                        key={alert.id}
                        onClick={() => handleSelectAlert(alert)}
                        className={`relative group p-1.5 rounded border flex justify-between items-center cursor-pointer transition-all hover:bg-red-500/10 hover:border-red-400 ${
                          darkMode ? 'bg-slate-900 border-red-500/30' : 'bg-white border-red-200 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-slate-900'}`}>{alert.unit}</div>
                        <div className="text-[9px] text-slate-500">{getAreaLabel(alert)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-red-500 font-mono">+{getOpenDurationValue(alert.time)}m</div>
                          <div className="text-[8px] text-red-400 uppercase font-bold">LATE</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-emerald-500 opacity-70">
                      <CheckCircle size={24} className="mb-1" />
                      <span className="text-[10px] text-center">
                        No overdue alerts.
                        <br />
                        Great Job!
                      </span>
                    </div>
                  )}
                </div>
                <PaginationControls currentPage={delayedPage} totalPages={Math.ceil(overdueAlerts.length / ITEMS_DELAYED)} onPageChange={setDelayedPage} />
              </div>
            </div>
          </div>

          {/* 3. STRATEGIC INSIGHTS */}
          <div className="flex-1 flex gap-[1.5vh] min-h-0">
            {/* Recurrent Fatigue Units */}
            <div className={`flex-1 rounded-xl border p-[1.5vh] overflow-hidden flex flex-col ${getCardBg()}`}>
              <div className="flex items-center justify-between mb-[1vh] shrink-0">
                <div className="flex items-center gap-2">
                  <Users className="w-[2vh] h-[2vh] text-red-500" />
                  <h3 className={`text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    RECURRENT FATIGUE UNITS
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRecurrentSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                    }
                    disabled={highRiskOperators.length <= 1}
                    className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      darkMode
                        ? 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                        : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400'
                    } ${highRiskOperators.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {recurrentSortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                  <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {highRiskOperators.length} Total
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-hidden" ref={recurrentListContainerRef}>
                <div className="flex-1 space-y-1.5">
                  {highRiskOperators.length > 0 ? (
                    paginate(highRiskOperators, recurrentPage, dynamicItemsPerPage.recurrent).map((op, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedRecurrentUnit(op.unit)}
                        className={`p-1.5 rounded border-l-2 border-red-500 flex justify-between items-center cursor-pointer transition-all hover:scale-[1.01] ${
                          darkMode ? 'bg-slate-900/50 hover:border-slate-500' : 'bg-white border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className={`font-bold text-xs ${darkMode ? 'text-white' : 'text-slate-800'}`}>{op.unit}</div>
                          <div className="text-[9px] text-slate-500">
                            {op.name} • <span className="text-red-500 font-semibold">{op.events} events</span>
                          </div>
                        </div>
                        <div className="text-[9px] text-red-500 font-bold px-1.5 py-0.5 bg-red-500/10 rounded">MONITORING</div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-xs">No recurrent data</div>
                  )}
                </div>
                <PaginationControls currentPage={recurrentPage} totalPages={Math.ceil(highRiskOperators.length / dynamicItemsPerPage.recurrent)} onPageChange={setRecurrentPage} />
              </div>
            </div>

            {/* High Risk Fatigue Area */}
            <div className={`flex-1 rounded-xl border p-[1.5vh] overflow-hidden flex flex-col ${getCardBg()}`}>
              <div className="flex items-center justify-between mb-[1vh] shrink-0">
                <div className="flex items-center gap-2">
                  <MapPin className="w-[2vh] h-[2vh] text-orange-500" />
                  <h3 className={`text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    HIGH RISK AREA
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHighRiskSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                    }
                    disabled={highFreqZones.length <= 1}
                    className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      darkMode
                        ? 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                        : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400'
                    } ${highFreqZones.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {highRiskSortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                  <span className="bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {highFreqZones.length} Total
                  </span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-hidden" ref={highRiskListContainerRef}>
                <div className="flex-1 space-y-1.5">
                  {highFreqZones.length > 0 ? (
                    paginate(highFreqZones, highRiskPage, dynamicItemsPerPage.highRisk).map((zone, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedRiskArea(zone.location)}
                        className={`p-1.5 rounded border flex justify-between items-center cursor-pointer transition-all hover:scale-[1.01] ${
                          darkMode
                            ? 'bg-slate-900/50 border-slate-700 hover:border-slate-500'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            <span className={`text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{zone.location}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 ml-3">
                            Events: <span className="font-mono font-bold text-slate-400">{zone.count}</span>
                          </div>
                        </div>
                        <div
                          className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 font-medium ${
                            zone.area === 'Mining'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                              : 'bg-teal-500/10 text-teal-500 border-teal-500/20'
                          }`}
                        >
                          {zone.area === 'Mining' ? <Activity size={8} /> : <Truck size={8} />} {zone.area.toUpperCase()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500 text-xs">No high risk data</div>
                  )}
                </div>
                <PaginationControls currentPage={highRiskPage} totalPages={Math.ceil(highFreqZones.length / dynamicItemsPerPage.highRisk)} onPageChange={setHighRiskPage} />
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="flex-1 flex flex-col gap-[1.5vh] min-w-[260px] lg:min-w-[300px] h-full">
          {/* 1. GLOBAL FILTER CARD */}
          <div className={`p-[2vh] rounded-xl border flex flex-col justify-center shrink-0 h-[16vh] min-h-[100px] ${getCardBg()}`}>
            <div className="flex items-center gap-2 mb-2">
              <Filter size={16} className={darkMode ? 'text-slate-400' : 'text-slate-500'} />
              <span className={`text-[clamp(0.7rem,1vh,0.9rem)] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Global Filter</span>
            </div>
            <div className={`flex p-1 rounded-lg ${darkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
              {['All', 'Mining', 'Hauling'].map((area) => (
                <button
                  key={area}
                  onClick={() => handleAreaTabClick(area)}
                  className={`flex-1 py-[1vh] text-[clamp(0.7rem,1.2vh,1rem)] font-bold rounded-md transition-all ${
                    selectedArea === area
                      ? darkMode
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-white text-slate-900 shadow'
                      : 'text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-right opacity-60">
              Viewing: <span className="font-bold text-blue-500">{selectedArea.toUpperCase()}</span>
              {selectedLocationFilter && (
                <span>
                  {' '}
                  • <span className="text-amber-500">{selectedLocationFilter}</span>
                </span>
              )}
            </div>
          </div>

          {/* 2. ACTIVE FATIGUE RECENT LIST */}
          <div className={`flex-1 flex flex-col rounded-xl border overflow-hidden ${getCardBg()}`}>
            <div className="p-[2vh] border-b border-inherit shrink-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap className="text-yellow-500 w-[2.5vh] h-[2.5vh]" />
                  <h3 className={`font-bold text-[clamp(1rem,1.5vh,1.5rem)] ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                    Active Fatigue Recent
                  </h3>
                </div>
                <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {filteredAlerts.length} Total
                </span>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
                  }
                  disabled={filteredAlerts.length <= 1}
                  className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-1 rounded border ${
                    darkMode
                      ? 'border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                      : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400'
                  } ${filteredAlerts.length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {activeSortOrder === 'newest' ? 'Newest' : 'Oldest'}
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between overflow-hidden p-[1.5vh]" ref={activeFatigueListContainerRef}>
              <div className="space-y-[1vh]">
                {filteredAlerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <CheckCircle size={40} className="mb-2" />
                    <p className="text-sm text-center">All clear</p>
                    {selectedLocationFilter && (
                      <button onClick={() => setSelectedLocationFilter(null)} className="mt-2 text-blue-500 underline text-xs">
                        Clear Filter
                      </button>
                    )}
                  </div>
                ) : (
                  paginate(sortedActiveAlerts, activeFatiguePage, dynamicItemsPerPage.activeFatigue).map((alert) => {
                    const displayTime = DEMO_MODE ? demoTimeString : alert.time;
                    return (
                    <div
                      key={alert.id}
                      className={`relative p-[1vh] rounded-lg border transition-all hover:scale-[1.01] cursor-pointer group ${
                        darkMode
                          ? 'bg-slate-800 border-l-4 border-l-red-500 border-y-slate-700 border-r-slate-700 hover:border-slate-500'
                          : 'bg-white border-l-4 border-l-red-500 border-y-slate-200 border-r-slate-200 shadow-sm hover:shadow-md'
                      }`}
                      onClick={() => handleSelectAlert(alert)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-600 text-white`}>
                            {alert.fatigue || alert.type || 'Fatigue'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">{displayTime}</span>
                        </div>
                        <span className="text-[9px] text-red-500 font-bold flex items-center gap-1 animate-pulse">
                          <AlertTriangle size={8} /> ACTIVE
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                          <Truck className={`w-[2vh] h-[2vh] ${darkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                        </div>
                        <div>
                          <h4 className={`font-bold text-[clamp(0.8rem,1vh,1rem)] ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                            {alert.unit || 'Unknown'}
                          </h4>
                          <p className="text-[9px] text-slate-500">
                            {alert.operator || 'Unknown'} • {alert.count}x Today
                          </p>
                        </div>
                      </div>
                      <div className={`text-[9px] p-1.5 rounded flex justify-between items-center ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        <div className="flex items-center gap-1 text-slate-500 font-medium">
                          <Map size={10} />
                          <span>{getAreaLabel(alert)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-red-400 font-mono font-bold animate-pulse">
                          <Clock size={10} />
                          <span>+{getOpenDuration(displayTime)}m</span>
                        </div>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
              <PaginationControls
                currentPage={activeFatiguePage}
                totalPages={Math.ceil(sortedActiveAlerts.length / dynamicItemsPerPage.activeFatigue)}
                onPageChange={setActiveFatiguePage}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SCCDashboard;
