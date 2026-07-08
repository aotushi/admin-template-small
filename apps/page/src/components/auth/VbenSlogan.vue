<template>
  <svg
    class="vben-slogan"
    viewBox="0 0 420 260"
    fill="none"
    role="img"
    aria-label="Admin workspace illustration"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="vben-slogan-screen" x1="110" x2="315" y1="58" y2="214">
        <stop stop-color="#60A5FA" />
        <stop offset="1" stop-color="#2563EB" />
      </linearGradient>
      <linearGradient id="vben-slogan-panel" x1="90" x2="330" y1="38" y2="222">
        <stop stop-color="white" stop-opacity=".92" />
        <stop offset="1" stop-color="white" stop-opacity=".52" />
      </linearGradient>
      <filter
        id="vben-slogan-shadow"
        x="35"
        y="24"
        width="350"
        height="220"
        color-interpolation-filters="sRGB"
        filterUnits="userSpaceOnUse"
      >
        <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#2563EB" flood-opacity=".18" />
      </filter>
    </defs>

    <path
      class="vben-slogan__glow"
      d="M93 202C132 246 254 250 316 207C382 161 347 69 267 55C163 36 39 142 93 202Z"
      fill="currentColor"
      opacity=".1"
    />
    <g filter="url(#vben-slogan-shadow)">
      <rect
        x="86"
        y="44"
        width="248"
        height="164"
        rx="24"
        fill="url(#vben-slogan-panel)"
        stroke="currentColor"
        stroke-opacity=".08"
      />
      <rect x="108" y="69" width="204" height="118" rx="16" fill="url(#vben-slogan-screen)" />
      <path
        d="M136 103h55M136 126h95M136 149h70"
        stroke="white"
        stroke-linecap="round"
        stroke-width="10"
        opacity=".82"
      />
      <rect x="248" y="101" width="38" height="62" rx="9" fill="white" opacity=".88" />
      <path
        d="M258 145h18M258 132h18M258 119h18"
        stroke="#2563EB"
        stroke-linecap="round"
        stroke-width="5"
      />
    </g>

    <circle cx="95" cy="80" r="10" fill="currentColor" opacity=".22" />
    <circle cx="337" cy="92" r="8" fill="currentColor" opacity=".18" />
    <circle cx="334" cy="204" r="12" fill="currentColor" opacity=".14" />
    <path
      d="M65 159c13-7 26-7 39 0M316 55c12 5 21 13 29 25"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-width="6"
      opacity=".18"
    />
  </svg>
</template>

<style scoped>
.vben-slogan {
  display: block;
  width: 100%;
  height: 100%;
  color: hsl(var(--primary));
}
</style>
