<script lang="ts">
  import PresentView from "#lib/components/PresentView.svelte";
  let { data } = $props();
</script>

{#key data.snapshot.org.id}
  <PresentView initial={data.snapshot} />
{/key}
