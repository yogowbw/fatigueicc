import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  LabelList,
  Label
} from 'recharts';
import {
  Menu,
  Sun,
  Moon,
  AlertTriangle,
  Activity,
  Settings,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Shield,
  Factory,
  Truck,
  BatteryCharging,
  Wifi,
  Monitor,
  Maximize,
  Smartphone,
  Gauge,
  MapPin,
  PieChart as PieChartIcon,
  Table as TableIcon,
  AlertCircle,
  PlusCircle,
  Layout,
  LayoutTemplate,
  Eye,
  Cigarette,
  Car,
  AlertOctagon,
  Zap,
  CheckCircle,
  XCircle,
  History,
  BrainCircuit,
  CloudRain,
  Wind,
  Thermometer,
  Signal,
  ClipboardCheck,
  BookOpen,
  HardHat,
  FileText,
  CheckSquare,
  Calendar as CalendarIcon,
  Info
} from 'lucide-react';

const ZONE_KEYS = [
  'ALL',
  'MINING',
  'HAULING',
  'ADMO',
  'ADMO_MINING',
  'ADMO_HAULING',
  'MACO',
  'MACO_MINING',
  'MACO_HAULING',
  'SERA',
  'SERA_MINING',
  'SERA_HAULING'
];

const createEmptyZoneData = () =>
  ZONE_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

const KPI_DEFINITIONS = [
  {
    key: 'FATALITY',
    title: 'Fatality',
    subtext: 'Kecelakaan yang mengakibatkan Hilangnya nyawa pekerja (Kematian)',
    colorType: 'fatality'
  },
  {
    key: 'KAPTK',
    title: 'KAPTK',
    subtext:
      'Kejadian Akibat Penyakit Tenaga Kerja (Kejadian korban mengalami kematian karena sakit) ditempat kerja',
    colorType: 'kaptk'
  },
  {
    key: 'LTI',
    title: 'LTI',
    subtext: 'Loss Time Injury (Kecelakaan yang berakibat hari hilang)',
    colorType: 'lti'
  },
  {
    key: 'MTI',
    title: 'MTI',
    subtext:
      'Medical Treatment Injury (Kecelakaan yang berakibat cedera dan perlu pertolongan medis)',
    colorType: 'mti'
  },
  {
    key: 'FAI',
    title: 'FAI',
    subtext:
      'First Aid Injury (Kecelakaan yang berakibat cedera tetapi perlu pertolongan pertama)',
    colorType: 'fai'
  },
  {
    key: 'PD',
    title: 'PD',
    subtext: 'Property Damage, Kecelakaan yang berakibat kerusakan',
    colorType: 'pd'
  },
  {
    key: 'EI',
    title: 'EI',
    subtext: 'Environment Incident, Kecelakaan yang berakibat pencemaran lingkungan',
    colorType: 'ei'
  },
  {
    key: 'NM',
    title: 'NM',
    subtext: 'Near Miss, Kecelakaan yang tidak menimbulkan kerugian',
    colorType: 'nm'
  }
];

const MONITORING_CARD_DEFINITIONS = [
  { key: 'FATIGUE', title: 'Fatigue Events', unit: 'Today', icon: Eye, color: 'red' },
  { key: 'OVERSPEED', title: 'Overspeed', unit: 'Events', icon: Gauge, color: 'orange' },
  { key: 'DISTRACTION', title: 'Distraction', unit: 'Cases', icon: Cigarette, color: 'yellow' },
  { key: 'PROXIMITY', title: 'Proximity', unit: 'Violations', icon: Car, color: 'blue' }
];

const LEADING_GAUGE_DEFINITIONS = [
  { title: 'All Progress' },
  { title: 'Hazard Report' },
  { title: 'Inspeksi' },
  { title: 'SAFE BEHAVIOUR OBSERVATION (SBO)' },
  { title: 'Custodian' }
];

const AIFR_LABELS = ['ALL SITE', 'ADMO', 'MACO', 'SERA'];

const DEFAULT_CALENDAR_LEGEND = [
  { label: 'FATALITY', color: '#000000', text: 'text-white' },
  { label: 'KAPTK', color: '#000000', text: 'text-white' },
  { label: 'LTI', color: '#ef4444', text: 'text-white' },
  { label: 'MTI', color: '#1e3a8a', text: 'text-white' },
  { label: 'FAI', color: '#38bdf8', text: 'text-black' },
  { label: 'PD', color: '#eab308', text: 'text-black' },
  { label: 'EI', color: '#9333ea', text: 'text-white' },
  { label: 'NEAR MISS', color: '#f97316', text: 'text-white' }
];

const DEFAULT_DASHBOARD_DATA = {
  siteTrendData: createEmptyZoneData(),
  aifrData: [],
  incidentDistributionData: createEmptyZoneData(),
  incidentCauseData: createEmptyZoneData(),
  hourlyFatigueComparison: [],
  monitoringRiskData: [],
  riskyOperators: [],
  incidentLocationsData: [],
  sensorStatusData: { total: 0, breakdown: [] },
  hazardPerSiteData: [],
  hazardMonthlyData: {},
  hazardMonthlyADMO: [],
  hazardMonthlyMACO: [],
  hazardMonthlySERA: [],
  hazardFollowUpData: [],
  leadingGaugeData: [],
  calendarEvents: [],
  safetyKpis: {},
  monitoringSummary: [],
  strategicScore: { score: 0, label: '', subtext: '', color: 'yellow' },
  weather: {
    temperature: 0,
    condition: '',
    windSpeed: 0,
    humidity: 0,
    alertText: '',
    alertLevel: 'high'
  },
  announcements: [],
  dashboardMeta: { lastUpdate: null },
  calendarMeta: {
    year: null,
    month: null,
    monthName: null,
    startDay: null,
    daysInMonth: null
  }
};

const normalizeKey = (value) => String(value || '').trim().toUpperCase();

const mergeZoneData = (data) => ({
  ...createEmptyZoneData(),
  ...(data || {})
});

const resolveApiBase = () => {
  const viteBase =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_BASE_URL
      : '';
  const craBase =
    typeof process !== 'undefined' && process.env
      ? process.env.REACT_APP_API_BASE_URL
      : '';
  const base = viteBase || craBase || '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
};

const resolveRefreshInterval = () => {
  const viteInterval =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_DASHBOARD_REFRESH_MS
      : '';
  const craInterval =
    typeof process !== 'undefined' && process.env
      ? process.env.REACT_APP_DASHBOARD_REFRESH_MS
      : '';
  const parsed = Number.parseInt(viteInterval || craInterval, 10);
  return Number.isNaN(parsed) ? 15000 : Math.max(parsed, 2000);
};

const buildApiUrl = (base, path) => (base ? `${base}${path}` : path);

const formatLastUpdate = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const API_BASE = resolveApiBase();
const REFRESH_INTERVAL_MS = resolveRefreshInterval();

// --- COMPONENTS ---
const CalendarActivity = ({ isDark, events = [], meta = {}, legend = DEFAULT_CALENDAR_LEGEND }) => {
  const now = new Date();
  const year = meta.year || now.getFullYear();
  const month = meta.month || now.getMonth() + 1;
  const monthIndex = month - 1;
  const daysInMonth = meta.daysInMonth || new Date(year, month, 0).getDate();

  const computedStartDay = Number.isInteger(meta.startDay)
    ? meta.startDay
    : (new Date(year, monthIndex, 1).getDay() + 6) % 7;

  const monthLabel = meta.monthName
    ? `${meta.monthName} ${year}`
    : new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
      })
        .format(new Date(year, monthIndex, 1))
        .toUpperCase();

  const days = [];
  for (let i = 0; i < computedStartDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getEventsForDay = (day) => {
    const found = events.find((event) => event.day === day);
    return found ? found.events : [];
  };

  const getEventStyle = (color) => {
    switch (color) {
      case 'black':
        return { bg: 'bg-black', text: 'text-white' };
      case 'red':
        return { bg: 'bg-red-500', text: 'text-white' };
      case 'blue':
        return { bg: 'bg-blue-900', text: 'text-white' };
      case 'skyblue':
        return { bg: 'bg-sky-400', text: 'text-black' };
      case 'yellow':
        return { bg: 'bg-yellow-500', text: 'text-black' };
      case 'purple':
        return { bg: 'bg-purple-600', text: 'text-white' };
      case 'orange':
        return { bg: 'bg-orange-500', text: 'text-white' };
      default:
        return { bg: 'bg-gray-500', text: 'text-white' };
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div
        className={`text-center font-bold text-sm 2xl:text-xl mb-2 ${
          isDark ? 'text-blue-400' : 'text-blue-700'
        }`}
      >
        {monthLabel}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div
            key={day}
            className={`text-[8px] 2xl:text-xs font-bold uppercase ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {day}
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 gap-1 auto-rows-fr">
        {days.map((day, idx) => {
          const dayEvents = day ? getEventsForDay(day) : [];
          const hasEvents = dayEvents.length > 0;
          const isSpecialRange = day && day >= 21 && day <= 31;

          let bgClass = isDark ? 'bg-slate-800/50' : 'bg-white';
          let borderClass = isDark ? 'border-slate-700' : 'border-slate-200';
          let textClass = isDark ? 'text-slate-500' : 'text-slate-400';

          if (day && !hasEvents && !isSpecialRange) {
            bgClass = isDark ? 'bg-lime-500/20' : 'bg-lime-200';
            borderClass = isDark ? 'border-lime-500/50' : 'border-lime-400';
          }

          if (isSpecialRange) {
            bgClass = isDark ? 'bg-slate-800/50' : 'bg-white';
            borderClass = isDark ? 'border-slate-700' : 'border-slate-200';
            textClass = isDark ? 'text-slate-500' : 'text-slate-400';
          }

          return (
            <div
              key={idx}
              className={`relative border rounded p-1 flex flex-col items-start justify-start overflow-hidden ${bgClass} ${borderClass}`}
            >
              {day && (
                <>
                  <span
                    className={`text-[8px] 2xl:text-xs font-bold absolute top-0.5 right-1 ${
                      !hasEvents && !isSpecialRange
                        ? isDark
                          ? 'text-lime-400'
                          : 'text-lime-800'
                        : textClass
                    }`}
                  >
                    {day}
                  </span>

                  {!isSpecialRange && (
                    <div className="flex flex-col gap-0.5 w-full mt-3 h-full justify-center">
                      {hasEvents ? (
                        dayEvents.map((event, eIdx) => {
                          const style = getEventStyle(event.color);
                          return (
                            <div
                              key={eIdx}
                              className={`${style.bg} ${style.text} text-[6px] 2xl:text-[9px] font-bold px-1 rounded-sm text-center w-full truncate`}
                            >
                              {event.site}
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <span
                            className={`text-[10px] 2xl:text-sm font-medium opacity-75 tracking-wider ${
                              isDark ? 'text-white' : 'text-black'
                            }`}
                          >
                            NIHIL
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2 border-t border-slate-600/30 pt-2">
        {legend.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <div
              className={`w-2 h-2 2xl:w-3 2xl:h-3 rounded-sm ${
                item.label === 'FATALITY' || item.label === 'KAPTK'
                  ? 'bg-black'
                  : item.label === 'LTI'
                  ? 'bg-red-500'
                  : item.label === 'MTI'
                  ? 'bg-blue-900'
                  : item.label === 'FAI'
                  ? 'bg-sky-400'
                  : item.label === 'PD'
                  ? 'bg-yellow-500'
                  : item.label === 'EI'
                  ? 'bg-purple-600'
                  : 'bg-orange-500'
              }`}
            ></div>
            <span
              className={`text-[8px] 2xl:text-[10px] font-bold ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SafetyKPIBox = ({ title, value, subtext, colorType, description }) => {
  const sheColors = {
    fatality: 'bg-black text-white border-l-4 2xl:border-l-8 border-red-600',
    kaptk: 'bg-black text-white border-l-4 2xl:border-l-8 border-red-600',
    lti: 'bg-red-500 text-white',
    mti: 'bg-blue-900 text-white',
    fai: 'bg-sky-400 text-slate-900',
    pd: 'bg-yellow-400 text-black',
    ei: 'bg-purple-600 text-white',
    nm: 'bg-orange-500 text-white'
  };

  const styleClass = sheColors[colorType] || 'bg-gray-500 text-white';
  const totalVal = parseInt(value, 10) || 0;
  const admoVal = Math.ceil(totalVal * 0.4);
  const macoVal = Math.floor(totalVal * 0.35);
  const seraVal = totalVal - admoVal - macoVal;

  const isLongSubtext = subtext && subtext.length > 20;
  const subtextClass = isLongSubtext
    ? 'text-[6px] 2xl:text-[10px] leading-snug px-1 line-clamp-4'
    : 'text-[8px] 2xl:text-sm leading-tight';

  const isSpecialLayout = [
    'Fatality',
    'KAPTK',
    'LTI',
    'MTI',
    'FAI',
    'PD',
    'EI',
    'NM'
  ].includes(title);

  return (
    <div
      className={`group relative p-2 2xl:p-4 rounded-lg 2xl:rounded-xl shadow-lg flex flex-col items-center justify-between h-full w-full overflow-hidden transition-transform transform hover:scale-[1.02] ${styleClass}`}
    >
      {description && (
        <div className="absolute top-1 right-1 opacity-50 group-hover:opacity-100 transition-opacity z-20">
          <Info size={12} />
        </div>
      )}

      <div className="flex flex-col items-center w-full z-10 h-full">
        <h3 className="text-[10px] 2xl:text-xl font-bold uppercase mb-0 2xl:mb-1 whitespace-nowrap opacity-90">
          {title}
        </h3>
        <div className="text-3xl 2xl:text-7xl font-extrabold my-0 2xl:my-1 font-jakarta leading-none">
          {value}
        </div>

        {!isSpecialLayout && (
          <p className={`${subtextClass} font-medium text-center opacity-75 mb-2 2xl:mb-4`}>
            {subtext}
          </p>
        )}

        <div
          className={`w-full grid grid-cols-3 gap-1 2xl:gap-2 border-t border-white/20 pt-1 2xl:pt-2 ${
            !isSpecialLayout ? 'mt-auto' : 'mt-1 mb-2'
          }`}
        >
          <div className="flex flex-col items-center">
            <span className="text-[7px] 2xl:text-xs font-bold opacity-70">ADMO</span>
            <span className="text-[10px] 2xl:text-lg font-bold">{admoVal}</span>
          </div>
          <div className="flex flex-col items-center border-l border-white/20">
            <span className="text-[7px] 2xl:text-xs font-bold opacity-70">MACO</span>
            <span className="text-[10px] 2xl:text-lg font-bold">{macoVal}</span>
          </div>
          <div className="flex flex-col items-center border-l border-white/20">
            <span className="text-[7px] 2xl:text-xs font-bold opacity-70">SERA</span>
            <span className="text-[10px] 2xl:text-lg font-bold">{seraVal}</span>
          </div>
        </div>

        {isSpecialLayout && (
          <div className="mt-auto border-t border-white/10 pt-1 w-full flex justify-center">
            <p className={`${subtextClass} font-medium text-center opacity-90`}>{subtext}</p>
          </div>
        )}
      </div>
      <div className="absolute -bottom-2 -right-2 2xl:-bottom-4 2xl:-right-4 opacity-10 pointer-events-none">
        <Shield className="w-12 h-12 2xl:w-[80px] 2xl:h-[80px]" />
      </div>

      {description && (
        <div className="absolute inset-0 bg-slate-900/95 p-3 flex items-center justify-center text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 rounded-lg backdrop-blur-sm">
          <p className="text-white text-[9px] 2xl:text-xs font-medium leading-relaxed">
            {description}
          </p>
        </div>
      )}
    </div>
  );
};

const GaugeKPIBox = ({ title, value, isDark }) => {
  const data = [
    { name: 'Poor', value: 20, color: '#ef4444' },
    { name: 'Fair', value: 20, color: '#ec4899' },
    { name: 'Good', value: 20, color: '#eab308' },
    { name: 'Great', value: 20, color: '#4ade80' },
    { name: 'Excellent', value: 20, color: '#15803d' }
  ];

  const rotation = (value / 100) * 180 - 90;

  return (
    <div
      className={`flex flex-col items-center justify-between p-2 rounded-lg shadow-md h-full ${
        isDark ? 'bg-slate-800' : 'bg-white'
      } border border-slate-600/30 relative overflow-hidden`}
    >
      <h4
        className={`text-[10px] 2xl:text-sm font-bold uppercase text-center mb-1 z-10 ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {title}
      </h4>
      <div className="relative w-full flex-1 flex items-end justify-center pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="50%"
              outerRadius="100%"
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          className="absolute bottom-2 left-1/2 w-0.5 h-[60%] bg-black dark:bg-white origin-bottom transition-transform duration-1000 ease-out"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-inherit rounded-full"></div>
        </div>
        <div className="absolute bottom-1 left-1/2 w-3 h-3 bg-slate-500 rounded-full -translate-x-1/2"></div>
      </div>
      <div className="text-center z-10">
        <span
          className={`text-xl 2xl:text-3xl font-extrabold ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {value}%
        </span>
      </div>
    </div>
  );
};

const MonitoringCard = ({ title, value, unit, icon: Icon, color, isDark, trend, subtext }) => {
  const colorMap = {
    red: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-700' },
    orange: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-700' },
    yellow: { bg: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-600' },
    blue: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-700' }
  };
  const theme = colorMap[color] || colorMap.blue;

  return (
    <div
      className={`p-4 rounded-xl shadow-lg border-b-4 ${theme.border} ${theme.bg} ${theme.text} flex flex-col justify-between relative overflow-hidden h-full`}
    >
      <div className="flex justify-between items-start z-10">
        <h3 className="font-bold text-sm 2xl:text-xl uppercase opacity-90">{title}</h3>
        <Icon className="w-6 h-6 2xl:w-10 2xl:h-10 opacity-80" />
      </div>
      <div className="z-10 mt-2">
        <div className="text-4xl 2xl:text-7xl font-extrabold font-jakarta">
          {value}{' '}
          <span className="text-sm 2xl:text-2xl font-medium opacity-70">{unit}</span>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-xs 2xl:text-sm font-bold bg-black/20 w-fit px-2 py-1 rounded">
            {trend === 'up' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {subtext}
          </div>
        )}
      </div>
      <Icon className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10" />
    </div>
  );
};

const SensorStatusCard = ({ data, isDark }) => (
  <div
    className={`p-4 rounded-xl shadow-lg border-l-4 border-purple-500 ${
      isDark ? 'bg-slate-800' : 'bg-white'
    } flex flex-col justify-between h-full`}
  >
    <div className="flex justify-between items-start">
      <h4 className={`text-xs 2xl:text-lg font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        Sensor Health
      </h4>
      <Signal size={20} className="text-purple-500" />
    </div>
    <div className="mt-1 text-center">
      <div className={`text-3xl 2xl:text-5xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {data.total}
      </div>
      <div className={`text-[8px] 2xl:text-xs font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        Units Installed
      </div>
    </div>
    <div className="mt-2 flex justify-between gap-1 text-[8px] 2xl:text-xs">
      {data.breakdown.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className={`w-2 h-2 2xl:w-3 2xl:h-3 rounded-full ${item.bg} mb-1`}></div>
          <span className={`font-bold ${item.color}`}>{item.value}</span>
          <span className="opacity-60">{item.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const WeatherWidget = ({ isDark, data }) => {
  const temperature = Number.isFinite(data?.temperature) ? data.temperature : null;
  const condition = data?.condition || '';
  const windSpeed = Number.isFinite(data?.windSpeed) ? data.windSpeed : null;
  const humidity = Number.isFinite(data?.humidity) ? data.humidity : null;
  const alertText = data?.alertText || '';
  const alertLevel = (data?.alertLevel || 'high').toLowerCase();

  const conditionLower = condition.toLowerCase();
  const WeatherIcon = conditionLower.includes('rain')
    ? CloudRain
    : conditionLower.includes('clear')
    ? Sun
    : conditionLower.includes('wind')
    ? Wind
    : CloudRain;

  const alertTheme = {
    high: { bg: isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700' },
    medium: { bg: isDark ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-700' },
    low: { bg: isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' }
  };
  const alertStyle = alertTheme[alertLevel] || alertTheme.high;

  return (
    <div
      className={`p-4 rounded-xl shadow-lg border-l-4 border-blue-400 ${
        isDark ? 'bg-slate-800' : 'bg-white'
      } flex flex-col justify-between h-full`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className={`text-xs 2xl:text-lg font-bold uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Current Weather
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <WeatherIcon className="w-8 h-8 2xl:w-12 2xl:h-12 text-blue-500" />
            <div>
              <div className={`text-2xl 2xl:text-4xl font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {temperature === null ? '-' : `${temperature}C`}
              </div>
              <div className={`text-[10px] 2xl:text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {condition || '-'}
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`flex items-center gap-1 text-xs 2xl:text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            <Wind size={16} /> {windSpeed === null ? '-' : `${windSpeed} km/h`}
          </div>
          <div
            className={`flex items-center gap-1 text-xs 2xl:text-sm ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            } mt-1`}
          >
            <Thermometer size={16} /> {humidity === null ? '-' : `${humidity}% Hum`}
          </div>
        </div>
      </div>
      {alertText ? (
        <div className={`mt-2 p-2 rounded ${alertStyle.bg} text-[10px] 2xl:text-xs font-bold text-center`}>
          WARNING: {alertText}
        </div>
      ) : null}
    </div>
  );
};

const StrategicScoreCard = ({ title, score, label, subtext, color, isDark }) => {
  const colorMap = {
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500'
  };
  const textColor = colorMap[color] || 'text-blue-500';

  return (
    <div
      className={`p-4 rounded-xl shadow-lg border-l-4 ${
        isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-300'
      } flex flex-col items-center justify-center relative overflow-hidden h-full`}
    >
      <h4 className={`text-xs 2xl:text-lg font-bold uppercase mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {title}
      </h4>
      <div className="relative w-24 h-24 2xl:w-40 2xl:h-40 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke={isDark ? '#334155' : '#e2e8f0'} strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray={`${score * 2.8} 283`}
            className={textColor}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl 2xl:text-5xl font-extrabold ${textColor}`}>{score}</span>
          <span className="text-[10px] 2xl:text-sm font-bold uppercase opacity-70">{label}</span>
        </div>
      </div>
      <p className={`text-[10px] 2xl:text-xs mt-2 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {subtext}
      </p>
    </div>
  );
};

const SectionHeader = ({ title, icon: Icon, isDark, color = 'blue' }) => {
  const colorMap = {
    blue: {
      bg: isDark ? 'bg-blue-900/50' : 'bg-blue-100',
      icon: isDark ? 'text-blue-400' : 'text-blue-600'
    },
    green: {
      bg: isDark ? 'bg-green-900/50' : 'bg-green-100',
      icon: isDark ? 'text-green-400' : 'text-green-600'
    },
    orange: {
      bg: isDark ? 'bg-orange-900/50' : 'bg-orange-100',
      icon: isDark ? 'text-orange-400' : 'text-orange-600'
    },
    red: {
      bg: isDark ? 'bg-red-900/50' : 'bg-red-100',
      icon: isDark ? 'text-red-400' : 'text-red-600'
    }
  };

  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`flex items-center gap-2 mb-2`}>
      <div className={`p-1.5 rounded-lg ${theme.bg}`}>
        <Icon className={`w-4 h-4 2xl:w-6 2xl:h-6 ${theme.icon}`} />
      </div>
      <h2 className="text-xs 2xl:text-xl font-bold font-jakarta uppercase truncate">{title}</h2>
    </div>
  );
};

const SiteTrendChart = ({
  title,
  data,
  isDark,
  viewMode,
  gridColor,
  heightClass = 'h-full',
  withFrame = true,
  showLegend = true
}) => {
  const containerStyle = withFrame
    ? `${isDark ? 'bg-slate-800' : 'bg-white'} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-4 border-blue-500`
    : 'bg-transparent';
  const titleStyle = withFrame
    ? `text-center ${isDark ? 'text-slate-300' : 'text-slate-700'}`
    : `text-left pl-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`;

  const labelFontSize = viewMode === 'actual' ? 14 : 9;
  const tickFontSize = viewMode === 'actual' ? 18 : 8;

  return (
    <div className={`${heightClass} ${containerStyle} flex flex-col`}>
      <h4 className={`text-xs 2xl:text-xl font-bold uppercase mb-2 ${titleStyle}`}>{title}</h4>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              stroke={isDark ? '#94a3b8' : '#64748b'}
              fontSize={tickFontSize}
              tick={{ fontSize: tickFontSize }}
              tickLine={false}
              interval={0}
            />
            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={tickFontSize} tick={{ fontSize: tickFontSize }} tickLine={false} />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#fff',
                borderColor: gridColor,
                fontSize: viewMode === 'actual' ? '16px' : '12px'
              }}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ fontSize: viewMode === 'actual' ? '16px' : '10px', paddingTop: '5px' }}
                iconSize={viewMode === 'actual' ? 14 : 8}
              />
            )}
            <Bar dataKey="NM" stackId="a" fill="rgb(255, 192, 0)" barSize={viewMode === 'actual' ? 40 : 20} radius={[0, 0, 0, 0]} name="Near Miss">
              <LabelList dataKey="NM" position="center" fill="#000" fontSize={labelFontSize} fontWeight="bold" />
            </Bar>
            <Bar dataKey="Incident" stackId="a" fill="#ef4444" barSize={viewMode === 'actual' ? 40 : 20} radius={[4, 4, 0, 0]} name="Incident">
              <LabelList dataKey="Incident" position="top" fill="#fff" fontSize={labelFontSize} fontWeight="bold" />
            </Bar>
            <Line type="monotone" dataKey="Total" stroke={isDark ? '#fff' : '#334155'} strokeWidth={viewMode === 'actual' ? 4 : 2} dot={{ r: viewMode === 'actual' ? 6 : 3 }} name="Total">
              <LabelList dataKey="Total" position="top" fill={isDark ? '#fff' : '#000'} fontSize={labelFontSize} fontWeight="bold" offset={10} />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const CausePieChart = ({ title, data, isDark, viewMode, hideLegend = false }) => {
  const chartCy = hideLegend ? '30%' : '50%';
  const chartOuterRadius = hideLegend ? '90%' : '70%';
  const chartInnerRadius = hideLegend ? '55%' : '35%';
  const labelMultiplier = hideLegend ? 1.25 : 1.4;

  const renderLabel = (props) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value } = props;
    const RADIAN = Math.PI / 180;

    const radius = outerRadius * labelMultiplier;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill={isDark ? 'white' : 'black'}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={viewMode === 'actual' ? 14 : 9}
        fontWeight="bold"
      >
        {`${Number(value) % 1 === 0 ? value : value.toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <h5 className={`text-[8px] 2xl:text-lg font-bold uppercase mb-1 text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {title}
      </h5>

      <div className={`${hideLegend ? 'flex-1' : 'flex-[2]'} w-full relative min-h-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy={chartCy}
              innerRadius={chartInnerRadius}
              outerRadius={chartOuterRadius}
              paddingAngle={2}
              dataKey="value"
              label={renderLabel}
              labelLine={{ stroke: isDark ? '#94a3b8' : '#475569', strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth={1} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#fff',
                borderColor: '#334155',
                fontSize: '10px',
                padding: '5px'
              }}
              formatter={(value) => `${value}%`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {!hideLegend && (
        <div className="flex-[3] w-full overflow-y-auto custom-scrollbar px-2 mt-2">
          <div className="flex flex-col gap-1 2xl:gap-2">
            {data.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-1 2xl:gap-2">
                <div className="shrink-0 w-2 h-2 2xl:w-3 2xl:h-3 rounded-sm mt-0.5" style={{ backgroundColor: entry.color }}></div>
                <div className="flex-1 text-[7px] 2xl:text-xs">
                  <span className={`${isDark ? 'text-slate-300' : 'text-slate-700'} leading-tight`}>{entry.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SharedCauseLegend = ({ data, isDark }) => (
  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1 px-2 border-t border-slate-600/20 pt-1">
    {data.map((entry, idx) => (
      <div key={idx} className="flex items-center gap-1">
        <div className="shrink-0 w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }}></div>
        <span className={`text-[8px] 2xl:text-[10px] font-medium leading-none ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {entry.name}
        </span>
      </div>
    ))}
  </div>
);

export default function DashboardVideoWall() {
  const [isDark, setIsDark] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState('fit');
  const [activeZone, setActiveZone] = useState('all');
  const [dashboardData, setDashboardData] = useState(DEFAULT_DASHBOARD_DATA);
  const [dataError, setDataError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let activeController = null;

    const fetchDashboard = async () => {
      if (!hasLoadedRef.current) {
        setIsLoading(true);
      }
      if (activeController) {
        activeController.abort();
      }
      activeController = new AbortController();
      try {
        const response = await fetch(buildApiUrl(API_BASE, '/api/dashboard'), {
          signal: activeController.signal
        });
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        if (isMounted) {
          setDashboardData((prev) => ({ ...prev, ...payload }));
          setDataError('');
          hasLoadedRef.current = true;
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Failed to load dashboard data', error);
          setDataError(error.message || 'Failed to load dashboard data');
        }
      } finally {
        if (isMounted && !activeController?.signal?.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboard();
    const intervalId = setInterval(fetchDashboard, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (activeController) {
        activeController.abort();
      }
      clearInterval(intervalId);
    };
  }, []);

  const handleZoneChange = (zone) => {
    setActiveZone(zone);
    if (zone !== 'all') {
      setViewMode('fit');
    }
  };

  const handleMouseEnter = () => setIsMenuOpen(true);
  const handleMouseLeave = () => setIsMenuOpen(false);

  const bgMain = isDark ? 'bg-slate-900' : 'bg-gray-100';
  const bgCard = isDark ? 'bg-slate-800' : 'bg-white';
  const textMain = isDark ? 'text-white' : 'text-slate-900';
  const textSub = isDark ? 'text-slate-400' : 'text-slate-500';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const isFocusMode = activeZone !== 'all';
  const containerWidthStyle = viewMode === 'actual' && !isFocusMode ? '14274px' : '100%';
  const containerScrollClass = viewMode === 'actual' && !isFocusMode ? 'overflow-auto' : 'overflow-y-auto';

  const siteTrendData = mergeZoneData(dashboardData.siteTrendData);
  const incidentDistributionData = mergeZoneData(dashboardData.incidentDistributionData);
  const incidentCauseData = mergeZoneData(dashboardData.incidentCauseData);

  const aifrSource = Array.isArray(dashboardData.aifrData) ? dashboardData.aifrData : [];
  const aifrMap = aifrSource.reduce((acc, item) => {
    acc[normalizeKey(item.name)] = item.value;
    return acc;
  }, {});

  const aifrData = AIFR_LABELS.map((label) => ({
    name: label,
    value: String(aifrMap[normalizeKey(label)] ?? 0)
  }));

  const safetyKpiValues = Object.entries(dashboardData.safetyKpis || {}).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});

  const monitoringSource = Array.isArray(dashboardData.monitoringSummary)
    ? dashboardData.monitoringSummary
    : [];
  const monitoringSummaryMap = monitoringSource.reduce((acc, item) => {
    acc[normalizeKey(item.key)] = item;
    return acc;
  }, {});

  const monitoringCards = MONITORING_CARD_DEFINITIONS.map((definition) => {
    const summary = monitoringSummaryMap[definition.key] || {};
    return {
      ...definition,
      value: summary.value ?? 0,
      unit: summary.unit || definition.unit,
      trend: summary.trend ? String(summary.trend).toLowerCase() : null,
      subtext: summary.subtext || ''
    };
  });

  const leadingGaugeSource = Array.isArray(dashboardData.leadingGaugeData)
    ? dashboardData.leadingGaugeData
    : [];
  const leadingGaugeMap = leadingGaugeSource.reduce((acc, item) => {
    acc[normalizeKey(item.title)] = item;
    return acc;
  }, {});

  const leadingGaugeData = LEADING_GAUGE_DEFINITIONS.map((definition) => ({
    title: definition.title,
    value: leadingGaugeMap[normalizeKey(definition.title)]?.value ?? 0
  }));

  const hazardMonthlyADMO =
    dashboardData.hazardMonthlyADMO?.length > 0
      ? dashboardData.hazardMonthlyADMO
      : dashboardData.hazardMonthlyData?.ADMO || [];
  const hazardMonthlyMACO =
    dashboardData.hazardMonthlyMACO?.length > 0
      ? dashboardData.hazardMonthlyMACO
      : dashboardData.hazardMonthlyData?.MACO || [];
  const hazardMonthlySERA =
    dashboardData.hazardMonthlySERA?.length > 0
      ? dashboardData.hazardMonthlySERA
      : dashboardData.hazardMonthlyData?.SERA || [];

  const dashboardMeta = dashboardData.dashboardMeta || DEFAULT_DASHBOARD_DATA.dashboardMeta;
  const calendarMeta = dashboardData.calendarMeta || DEFAULT_DASHBOARD_DATA.calendarMeta;
  const calendarLegend = DEFAULT_CALENDAR_LEGEND;
  const announcementItems = Array.isArray(dashboardData.announcements) ? dashboardData.announcements : [];

  const lastUpdateLabel = formatLastUpdate(dashboardMeta.lastUpdate);

  return (
    <div
      className={`min-h-screen w-full ${bgMain} ${textMain} font-sans transition-colors duration-500 relative flex flex-col p-2 ${containerScrollClass}`}
      style={{ width: containerWidthStyle, minWidth: containerWidthStyle }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139, 0.5); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139, 0.8); }
      `}</style>

      <div
        className={`fixed left-0 top-0 h-full z-[100] transition-all duration-300 ${isMenuOpen ? 'w-64' : 'w-4'} hover:w-64 group`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className={`h-full w-full ${
            isDark ? 'bg-slate-950/95 border-r border-slate-700' : 'bg-white/95 border-r border-gray-200'
          } backdrop-blur-md shadow-2xl overflow-hidden flex flex-col`}
        >
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-20 rounded-r-md ${
              isDark ? 'bg-blue-500' : 'bg-blue-600'
            } ${isMenuOpen ? 'opacity-0' : 'opacity-100'}`}
          />
          <div className={`p-6 flex flex-col h-full ${!isMenuOpen && 'opacity-0'} transition-opacity duration-200`}>
            <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
              <Settings size={24} /> Controls
            </h3>
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold opacity-70">Theme Mode</label>
                <div className="flex gap-2 p-1 rounded-lg bg-slate-200/20">
                  <button
                    onClick={() => setIsDark(false)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                      !isDark ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Sun size={18} /> Light
                  </button>
                  <button
                    onClick={() => setIsDark(true)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                      isDark ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Moon size={18} /> Dark
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold opacity-70">View Size</label>
                <div className="flex gap-2 p-1 rounded-lg bg-slate-200/20">
                  <button
                    onClick={() => setViewMode('fit')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                      viewMode === 'fit'
                        ? isDark
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-white text-black shadow-sm'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    <Smartphone size={18} /> Laptop
                  </button>
                  <button
                    onClick={() => setViewMode('actual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-all ${
                      viewMode === 'actual'
                        ? isDark
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'bg-white text-black shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Maximize size={18} /> Wall
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold opacity-70">Zone Focus</label>
                <div className="flex flex-col gap-2 p-1 rounded-lg bg-slate-200/20">
                  <button
                    onClick={() => handleZoneChange('all')}
                    className={`py-2 px-3 text-left rounded-md text-sm transition-all ${
                      activeZone === 'all'
                        ? isDark
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-black'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    All Zones (3 TV)
                  </button>
                  <button
                    onClick={() => handleZoneChange('1')}
                    className={`py-2 px-3 text-left rounded-md text-sm transition-all ${
                      activeZone === '1'
                        ? isDark
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-black'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    TV 1 (Safety)
                  </button>
                  <button
                    onClick={() => handleZoneChange('2')}
                    className={`py-2 px-3 text-left rounded-md text-sm transition-all ${
                      activeZone === '2'
                        ? isDark
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-black'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    TV 2 (Leading)
                  </button>
                  <button
                    onClick={() => handleZoneChange('3')}
                    className={`py-2 px-3 text-left rounded-md text-sm transition-all ${
                      activeZone === '3'
                        ? isDark
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-black'
                        : 'text-gray-500 hover:text-gray-400'
                    }`}
                  >
                    TV 3 (Fatigue)
                  </button>
                </div>
              </div>
              {dataError ? (
                <div className="text-xs text-red-400 font-semibold">API Error: {dataError}</div>
              ) : null}
              {isLoading ? <div className="text-xs text-slate-400">Loading data...</div> : null}
            </div>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col gap-2 2xl:gap-4`}>
        <div className={`grid ${activeZone === 'all' ? 'grid-cols-3' : 'grid-cols-1'} gap-6`}>
          {(activeZone === 'all' || activeZone === '1') && (
            <div className={`col-span-1 flex flex-col gap-4 2xl:gap-8 ${activeZone === 'all' && 'border-r border-slate-500/30 pr-6'}`}>
              <div className={`shrink-0 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-indigo-500`}>
                <div className="flex items-center justify-between mb-2 2xl:mb-4">
                  <SectionHeader title="SHE Performance Indicators" icon={Shield} isDark={isDark} />
                  <div className={`text-right ${textSub} text-[10px] 2xl:text-sm font-medium`}>
                    Last Update:{' '}
                    <span className={`font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {lastUpdateLabel}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 2xl:gap-4">
                  {KPI_DEFINITIONS.map((definition) => (
                    <div key={definition.key} className="col-span-1">
                      <SafetyKPIBox
                        title={definition.title}
                        value={String(safetyKpiValues[definition.key] ?? 0)}
                        subtext={definition.subtext}
                        colorType={definition.colorType}
                        description={null}
                      />
                    </div>
                  ))}

                  <div
                    className={`col-span-4 rounded-lg 2xl:rounded-xl shadow-lg border-2 flex flex-col overflow-hidden ${
                      isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-100 border-slate-300'
                    }`}
                  >
                    <div
                      className={`py-1 text-center font-bold text-xs 2xl:text-xl uppercase ${
                        isDark ? 'bg-slate-700 text-blue-400' : 'bg-slate-200 text-blue-700'
                      }`}
                    >
                      AIFR
                    </div>
                    <div className="flex-1 grid grid-cols-4 divide-x divide-slate-500/30">
                      {aifrData.map((item, index) => (
                        <div key={index} className="flex flex-col items-center justify-center p-1">
                          <h4 className={`text-[8px] 2xl:text-base font-bold uppercase ${textSub}`}>{item.name}</h4>
                          <span className={`text-lg 2xl:text-4xl font-extrabold font-jakarta ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className={`flex flex-col gap-4 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-blue-600 overflow-hidden h-[650px]`}>
                <div className="flex-1 grid grid-cols-12 gap-4 h-full">
                  <div className="col-span-5 flex flex-col h-full border-r border-slate-600/30 pr-2">
                    <SectionHeader title="SHE CALENDAR" icon={CalendarIcon} isDark={isDark} color="blue" />
                    <div className="flex-1 min-h-0">
                      <CalendarActivity isDark={isDark} events={dashboardData.calendarEvents} meta={calendarMeta} legend={calendarLegend} />
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col h-full border-r border-slate-600/30 px-2 gap-2">
                    <div className="flex flex-col flex-1 min-h-0 border-b border-slate-600/20 pb-2">
                      <SectionHeader title="INCIDENT AREA (ALL SITE)" icon={TableIcon} isDark={isDark} color="green" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col border-r border-slate-600/30 pr-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            ALL AREA
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[9px] 2xl:text-sm font-medium">
                                {incidentDistributionData.ALL.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10 hover:bg-slate-500/5`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col border-r border-slate-600/30 px-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            MINING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[9px] 2xl:text-sm font-medium">
                                {incidentDistributionData.MINING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10 hover:bg-slate-500/5`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col pl-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                            HAULING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[9px] 2xl:text-sm font-medium">
                                {incidentDistributionData.HAULING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10 hover:bg-slate-500/5`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col flex-1 min-h-0 pt-2">
                      <SectionHeader title="INCIDENT AREA (ADMO)" icon={TableIcon} isDark={isDark} color="green" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col border-r border-slate-600/30 pr-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            ALL AREA
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.ADMO.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col border-r border-slate-600/30 px-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            MINING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.ADMO_MINING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col pl-1 overflow-hidden">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                            HAULING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.ADMO_HAULING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-col h-full pl-2 gap-2">
                    <div className="flex flex-col flex-1 min-h-0 border-b border-slate-600/20 pb-2">
                      <SectionHeader title="INCIDENT CAUSE (ALL SITE)" icon={AlertCircle} isDark={isDark} color="orange" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col h-full border-r border-slate-600/20 pr-1">
                          <CausePieChart title="ALL AREA" data={incidentCauseData.ALL} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full border-r border-slate-600/20 px-1">
                          <CausePieChart title="MINING" data={incidentCauseData.MINING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full pl-1">
                          <CausePieChart title="HAULING" data={incidentCauseData.HAULING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                      </div>
                      <SharedCauseLegend data={incidentCauseData.ALL} isDark={isDark} />
                    </div>

                    <div className="flex flex-col flex-1 min-h-0 pt-2">
                      <SectionHeader title="INCIDENT CAUSE (ADMO)" icon={AlertCircle} isDark={isDark} color="orange" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col h-full border-r border-slate-600/20 pr-1">
                          <CausePieChart title="ALL AREA" data={incidentCauseData.ADMO} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full border-r border-slate-600/20 px-1">
                          <CausePieChart title="MINING" data={incidentCauseData.ADMO_MINING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full pl-1">
                          <CausePieChart title="HAULING" data={incidentCauseData.ADMO_HAULING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                      </div>
                      <SharedCauseLegend data={incidentCauseData.ADMO} isDark={isDark} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={`grid grid-cols-12 gap-4 min-h-[950px] h-auto mb-10`}>
                <div className={`col-span-5 flex flex-col h-full ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-blue-600`}>
                  <div className="flex flex-col flex-1 border-b border-slate-600/20 pb-2 min-h-0">
                    <SectionHeader title="INCIDENT TREND (ALL SITE)" icon={Activity} isDark={isDark} color="blue" />
                    <div className="flex-1 grid grid-cols-3 gap-1 min-h-0">
                      <SiteTrendChart title="ALL AREA" data={siteTrendData.ALL} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="MINING" data={siteTrendData.MINING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="HAULING" data={siteTrendData.HAULING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 border-b border-slate-600/20 py-2 min-h-0">
                    <SectionHeader title="INCIDENT TREND (ADMO)" icon={Activity} isDark={isDark} color="green" />
                    <div className="flex-1 grid grid-cols-3 gap-1 min-h-0">
                      <SiteTrendChart title="ALL AREA" data={siteTrendData.ADMO} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="MINING" data={siteTrendData.ADMO_MINING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="HAULING" data={siteTrendData.ADMO_HAULING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 border-b border-slate-600/20 py-2 min-h-0">
                    <SectionHeader title="INCIDENT TREND (MACO)" icon={Activity} isDark={isDark} color="orange" />
                    <div className="flex-1 grid grid-cols-3 gap-1 min-h-0">
                      <SiteTrendChart title="ALL AREA" data={siteTrendData.MACO} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="MINING" data={siteTrendData.MACO_MINING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="HAULING" data={siteTrendData.MACO_HAULING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 pt-2 min-h-0">
                    <SectionHeader title="INCIDENT TREND (SERA)" icon={Activity} isDark={isDark} color="blue" />
                    <div className="flex-1 grid grid-cols-3 gap-1 min-h-0">
                      <SiteTrendChart title="ALL AREA" data={siteTrendData.SERA} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="MINING" data={siteTrendData.SERA_MINING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                      <SiteTrendChart title="HAULING" data={siteTrendData.SERA_HAULING} isDark={isDark} viewMode={viewMode} gridColor={gridColor} withFrame={false} showLegend={false} />
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-4 border-t border-slate-500/20 pt-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-[rgb(255,192,0)] rounded-sm"></div>
                      <span className={`text-[10px] 2xl:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Near Miss</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                      <span className={`text-[10px] 2xl:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Incident</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3 h-1 ${isDark ? 'bg-white' : 'bg-slate-800'}`}></div>
                      <span className={`text-[10px] 2xl:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-7 flex flex-col gap-4 h-full">
                  <div className={`flex-1 grid grid-cols-7 gap-4 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-orange-500`}>
                    <div className="col-span-4 flex flex-col h-full border-r border-slate-600/30 pr-2">
                      <SectionHeader title="INCIDENT AREA (MACO)" icon={TableIcon} isDark={isDark} color="green" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col border-r border-slate-600/30 pr-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            ALL AREA
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[9px] 2xl:text-sm font-medium">
                                {incidentDistributionData.MACO.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col border-r border-slate-600/30 px-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            MINING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.MACO_MINING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col pl-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                            HAULING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.MACO_HAULING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 flex flex-col h-full pl-2">
                      <SectionHeader title="INCIDENT CAUSE (MACO)" icon={AlertCircle} isDark={isDark} color="orange" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col h-full border-r border-slate-600/20 pr-1">
                          <CausePieChart title="ALL AREA" data={incidentCauseData.MACO} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full border-r border-slate-600/20 px-1">
                          <CausePieChart title="MINING" data={incidentCauseData.MACO_MINING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full pl-1">
                          <CausePieChart title="HAULING" data={incidentCauseData.MACO_HAULING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                      </div>
                      <SharedCauseLegend data={incidentCauseData.MACO} isDark={isDark} />
                    </div>
                  </div>

                  <div className={`flex-1 grid grid-cols-7 gap-4 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-purple-500`}>
                    <div className="col-span-4 flex flex-col h-full border-r border-slate-600/30 pr-2">
                      <SectionHeader title="INCIDENT AREA (SERA)" icon={TableIcon} isDark={isDark} color="green" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col border-r border-slate-600/30 pr-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            ALL AREA
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[9px] 2xl:text-sm font-medium">
                                {incidentDistributionData.SERA.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col border-r border-slate-600/30 px-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            MINING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.SERA_MINING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="flex flex-col pl-1">
                          <h5 className={`text-[8px] 2xl:text-sm font-bold uppercase text-center mb-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                            HAULING
                          </h5>
                          <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                              <tbody className="text-[8px] 2xl:text-xs font-medium">
                                {incidentDistributionData.SERA_HAULING.map((row, idx) => (
                                  <tr key={idx} className={`border-b border-slate-600/10`}>
                                    <td className="py-1">{row.name}</td>
                                    <td className="py-1 text-right font-bold">{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 flex flex-col h-full pl-2">
                      <SectionHeader title="INCIDENT CAUSE (SERA)" icon={AlertCircle} isDark={isDark} color="orange" />
                      <div className="flex-1 grid grid-cols-3 gap-1 overflow-hidden">
                        <div className="flex flex-col h-full border-r border-slate-600/20 pr-1">
                          <CausePieChart title="ALL AREA" data={incidentCauseData.SERA} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full border-r border-slate-600/20 px-1">
                          <CausePieChart title="MINING" data={incidentCauseData.SERA_MINING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                        <div className="flex flex-col h-full pl-1">
                          <CausePieChart title="HAULING" data={incidentCauseData.SERA_HAULING} isDark={isDark} viewMode={viewMode} hideLegend={true} />
                        </div>
                      </div>
                      <SharedCauseLegend data={incidentCauseData.SERA} isDark={isDark} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeZone === 'all' || activeZone === '2') && (
            <div className={`col-span-1 flex flex-col gap-4 2xl:gap-8 ${activeZone === 'all' && 'border-r border-slate-500/30 pr-6'}`}>
              <div className={`shrink-0 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-green-500`}>
                <SectionHeader title="SHE LEADING PERFORMANCE INDICATORS" icon={Shield} isDark={isDark} color="green" />

                <div className="grid grid-cols-5 gap-2 2xl:gap-4 h-32 2xl:h-48 mt-4">
                  {leadingGaugeData.map((kpi, idx) => (
                    <div key={idx} className="col-span-1 h-full">
                      <GaugeKPIBox title={kpi.title} value={kpi.value} isDark={isDark} />
                    </div>
                  ))}
                </div>
              </div>

              <div className={`flex flex-col flex-1 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-l-4 border-blue-500`}>
                <SectionHeader title="HAZARD REPORT" icon={Activity} isDark={isDark} color="blue" />

                <div className="flex flex-1 gap-4 mt-2">
                  <div className="flex-[4] flex flex-col border-r border-slate-600/30 pr-4">
                    <h3 className={`text-sm 2xl:text-xl font-bold uppercase mb-4 pl-2 border-l-4 border-green-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ACHIEVEMENTS
                    </h3>
                    <div className="grid grid-cols-4 gap-4 flex-1">
                      <div className="col-span-1 flex flex-col h-full">
                        <h5 className={`text-[8px] 2xl:text-xs font-bold uppercase text-center mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          IMPLEMENTASI HAZARD REPORT PER SITE
                        </h5>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={dashboardData.hazardPerSiteData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                              <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                              <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                              <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor, fontSize: '10px' }} />
                              <Bar dataKey="plan" fill="#3b82f6" barSize={15} name="Plan" />
                              <Bar dataKey="actual" fill="#10b981" barSize={15} name="Actual" />
                              <Line type="monotone" dataKey="ach" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Ach %" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="col-span-1 flex flex-col h-full border-l border-slate-600/30 pl-2">
                        <h5 className={`text-[8px] 2xl:text-xs font-bold uppercase text-center mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          IMPLEMENTASI HAZARD REPORT PER MONTH (ADMO)
                        </h5>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={hazardMonthlyADMO} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                              <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={8} tickLine={false} interval={1} />
                              <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                              <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor, fontSize: '10px' }} />
                              <Bar dataKey="plan" fill="#3b82f6" barSize={8} name="Plan" />
                              <Bar dataKey="actual" fill="#10b981" barSize={8} name="Actual" />
                              <Line type="monotone" dataKey="ach" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ach %" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="col-span-1 flex flex-col h-full border-l border-slate-600/30 pl-2">
                        <h5 className={`text-[8px] 2xl:text-xs font-bold uppercase text-center mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          IMPLEMENTASI HAZARD REPORT PER MONTH (MACO)
                        </h5>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={hazardMonthlyMACO} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                              <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={8} tickLine={false} interval={1} />
                              <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                              <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor, fontSize: '10px' }} />
                              <Bar dataKey="plan" fill="#3b82f6" barSize={8} name="Plan" />
                              <Bar dataKey="actual" fill="#10b981" barSize={8} name="Actual" />
                              <Line type="monotone" dataKey="ach" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ach %" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="col-span-1 flex flex-col h-full border-l border-slate-600/30 pl-2">
                        <h5 className={`text-[8px] 2xl:text-xs font-bold uppercase text-center mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          IMPLEMENTASI HAZARD REPORT PER MONTH (SERA)
                        </h5>
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={hazardMonthlySERA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                              <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={8} tickLine={false} interval={1} />
                              <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                              <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor, fontSize: '10px' }} />
                              <Bar dataKey="plan" fill="#3b82f6" barSize={8} name="Plan" />
                              <Bar dataKey="actual" fill="#10b981" barSize={8} name="Actual" />
                              <Line type="monotone" dataKey="ach" stroke="#f59e0b" strokeWidth={2} dot={false} name="Ach %" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-[1] flex flex-col">
                    <h3 className={`text-sm 2xl:text-xl font-bold uppercase mb-4 pl-2 border-l-4 border-orange-500 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      FOLLOW UP
                    </h3>
                    <div className="flex-1 flex flex-col h-full">
                      <h5 className={`text-[8px] 2xl:text-xs font-bold uppercase text-center mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        FOLLOW UP HAZARD REPORT
                      </h5>
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={dashboardData.hazardFollowUpData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} fontSize={10} tickLine={false} />
                            <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor, fontSize: '10px' }} />
                            <Bar dataKey="plan" fill="#6366f1" barSize={20} name="Plan" />
                            <Bar dataKey="actual" fill="#8b5cf6" barSize={20} name="Actual" />
                            <Line type="monotone" dataKey="ach" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Ach %" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeZone === 'all' || activeZone === '3') && (
            <div className={`col-span-1 flex flex-col gap-4 2xl:gap-8 ${activeZone === 'all' && 'border-l border-slate-500/30 pl-6'}`}>
              <div className={`shrink-0 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-t-2 2xl:border-t-8 border-red-500`}>
                <SectionHeader title="OPERATOR SAFETY & FATIGUE MONITORING" icon={Activity} isDark={isDark} color="red" />

                <div className="grid grid-cols-2 gap-2 2xl:gap-4 h-auto">
                  {monitoringCards.map((card) => (
                    <div key={card.key} className="col-span-1">
                      <MonitoringCard
                        title={card.title}
                        value={card.value}
                        unit={card.unit}
                        icon={card.icon}
                        color={card.color}
                        isDark={isDark}
                        trend={card.trend}
                        subtext={card.subtext}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4 2xl:gap-6 min-h-0">
                <div className="flex flex-col gap-4 2xl:gap-6">
                  <div className={`flex flex-col flex-[2] ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-l-4 border-red-500`}>
                    <SectionHeader title="HOURLY FATIGUE: TODAY vs AVG" icon={Activity} isDark={isDark} color="red" />
                    <div className="flex-1 w-full min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.hourlyFatigueComparison} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="hour" stroke={isDark ? '#94a3b8' : '#64748b'} />
                          <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} />
                          <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: gridColor }} />
                          <Legend verticalAlign="top" height={36} />
                          <Area type="monotone" dataKey="today" stroke="#ef4444" fillOpacity={1} fill="url(#colorToday)" name="Today" />
                          <Area type="monotone" dataKey="avg" stroke="#3b82f6" fill="none" strokeDasharray="5 5" name="30-Day Avg" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`flex flex-col flex-[3] ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-l-4 border-blue-500`}>
                    <SectionHeader title="REAL-TIME MONITORING & HISTORICAL RISK" icon={AlertOctagon} isDark={isDark} color="blue" />
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className={`text-[10px] 2xl:text-sm uppercase ${textSub} border-b border-slate-600/30`}>
                          <tr>
                            <th className="py-2">Unit/Driver</th>
                            <th className="py-2">Event</th>
                            <th className="py-2">Cond.</th>
                            <th className="py-2">History Pattern</th>
                            <th className="py-2 text-right">Risk</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs 2xl:text-base font-medium">
                          {dashboardData.monitoringRiskData.map((alert) => (
                            <tr key={alert.id} className="border-b border-slate-600/10 hover:bg-slate-500/5">
                              <td className="py-2">
                                <div className="font-bold">{alert.unit}</div>
                                <div className={`text-[10px] ${textSub}`}>{alert.driver}</div>
                              </td>
                              <td className="py-2">
                                <div className={alert.risk === 'CRITICAL' ? 'text-red-500 font-bold' : ''}>{alert.type}</div>
                                <div className={`text-[10px] ${textSub}`}>@ {alert.location}</div>
                              </td>
                              <td className="py-2 text-center">
                                {alert.weather === 'rain' && <CloudRain size={16} className="text-blue-500 mx-auto" />}
                                {alert.weather === 'clear' && <Sun size={16} className="text-yellow-500 mx-auto" />}
                                {alert.weather === 'cloudy' && <Users size={16} className="text-gray-400 mx-auto" />}
                              </td>
                              <td className="py-2 text-xs 2xl:text-sm opacity-80">
                                {alert.history !== 'None' ? (
                                  <span className="flex items-center gap-1 text-orange-500">
                                    <History size={12} /> {alert.history}
                                  </span>
                                ) : (
                                  <span className="opacity-50">-</span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                <span
                                  className={`px-2 py-1 rounded text-[10px] 2xl:text-xs font-bold ${
                                    alert.risk === 'CRITICAL' || alert.risk === 'HIGH'
                                      ? 'bg-red-500 text-white'
                                      : alert.risk === 'MED'
                                      ? 'bg-yellow-500 text-black'
                                      : 'bg-blue-500 text-white'
                                  }`}
                                >
                                  {alert.risk}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 2xl:gap-6">
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="flex-1 flex gap-4">
                      <div className="flex-1">
                        <StrategicScoreCard
                          title="SHIFT RISK SCORE"
                          score={dashboardData.strategicScore.score}
                          label={dashboardData.strategicScore.label}
                          subtext={dashboardData.strategicScore.subtext}
                          color={dashboardData.strategicScore.color}
                          isDark={isDark}
                        />
                      </div>
                      <div className="flex-1">
                        <WeatherWidget isDark={isDark} data={dashboardData.weather} />
                      </div>
                      <div className="flex-1">
                        <SensorStatusCard data={dashboardData.sensorStatusData} isDark={isDark} />
                      </div>
                    </div>
                  </div>

                  <div className={`flex flex-col flex-[3] gap-4`}>
                    <div className={`flex-1 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-l-4 border-yellow-500 flex flex-col`}>
                      <SectionHeader title="TOP RISKY OPERATORS" icon={Users} isDark={isDark} color="orange" />
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                          <thead className={`text-[10px] 2xl:text-sm uppercase ${textSub} border-b border-slate-600/30`}>
                            <tr>
                              <th className="py-2">Rank</th>
                              <th className="py-2">Name</th>
                              <th className="py-2 text-right">Score</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs 2xl:text-base font-bold">
                            {dashboardData.riskyOperators.map((op) => (
                              <tr key={op.rank} className="border-b border-slate-600/10">
                                <td className="py-2">#{op.rank}</td>
                                <td className="py-2">
                                  <div>{op.name}</div>
                                  <div className={`text-[10px] font-normal ${textSub}`}>{op.unit}</div>
                                </td>
                                <td className="py-2 text-right text-red-500">{op.score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className={`flex-1 ${bgCard} rounded-xl 2xl:rounded-3xl p-3 2xl:p-6 shadow-xl border-l-4 border-red-500 flex flex-col`}>
                      <SectionHeader title="FREQUENT INCIDENT LOCATIONS" icon={MapPin} isDark={isDark} color="red" />
                      <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                          <thead className={`text-[10px] 2xl:text-sm uppercase ${textSub} border-b border-slate-600/30`}>
                            <tr>
                              <th className="py-2">Location</th>
                              <th className="py-2 text-right">Incidents</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs 2xl:text-base font-bold">
                            {dashboardData.incidentLocationsData.map((loc, idx) => (
                              <tr key={idx} className="border-b border-slate-600/10">
                                <td className="py-2">{loc.name}</td>
                                <td
                                  className={`py-2 text-right ${
                                    loc.level === 'Critical'
                                      ? 'text-red-500'
                                      : loc.level === 'High'
                                      ? 'text-orange-500'
                                      : 'text-yellow-500'
                                  }`}
                                >
                                  {loc.count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`mt-8 h-8 2xl:h-16 shrink-0 ${isDark ? 'bg-blue-900' : 'bg-blue-100'} rounded-lg flex items-center overflow-hidden border-t-2 ${isDark ? 'border-blue-700' : 'border-blue-200'}`}>
          <div
            className={`px-2 2xl:px-8 font-bold text-[10px] 2xl:text-xl uppercase ${
              isDark ? 'bg-blue-800 text-blue-200' : 'bg-blue-200 text-blue-800'
            } h-full flex items-center z-10 shadow-md`}
          >
            ANNOUNCEMENT
          </div>
          <div className="whitespace-nowrap animate-marquee flex items-center gap-12 px-4 text-xs 2xl:text-2xl font-medium tracking-wide">
            {announcementItems.map((item, index) => (
              <React.Fragment key={index}>
                <span>{item.message}</span>
                {index < announcementItems.length - 1 && <span>|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
