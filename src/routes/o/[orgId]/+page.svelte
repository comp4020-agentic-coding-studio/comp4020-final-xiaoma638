<script lang="ts">
  import OrgView from "#lib/components/OrgView.svelte";
  let { data } = $props();
</script>

{#key data.snapshot.org.id}
  <OrgView initial={data.snapshot} />
{/key}
