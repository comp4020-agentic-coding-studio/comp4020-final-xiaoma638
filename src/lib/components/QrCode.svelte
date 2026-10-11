<script lang="ts">
  import { encode } from "uqr";

  // Always dark modules on a light ground with a quiet zone, whatever the
  // theme: phone cameras read inverted codes poorly.
  let { value, label }: { value: string; label: string } = $props();

  const qr = $derived(encode(value, { border: 4, ecc: "M" }));
  const path = $derived(
    qr.data
      .flatMap((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : "")))
      .join(""),
  );
</script>

<svg class="qr" viewBox="0 0 {qr.size} {qr.size}" role="img" aria-label={label} shape-rendering="crispEdges">
  <rect width={qr.size} height={qr.size} fill="#fff" />
  <path d={path} fill="#111" />
</svg>

<style>
  .qr { display: block; width: 100%; height: auto; border-radius: 8px; }
</style>
