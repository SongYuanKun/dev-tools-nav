(function () {
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const mount = document.getElementById("aiRelatedReads");
    if (!mount || typeof AI_RELATED_READS_LINKS === "undefined") return;

    const items = AI_RELATED_READS_LINKS.map(
      (l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`
    ).join("");

    const trust =
      typeof AI_TRUST_STATEMENT !== "undefined"
        ? `<p class="ai-related-trust">${escapeHtml(AI_TRUST_STATEMENT)}</p>`
        : "";

    mount.innerHTML = `
      <h2 class="ai-related-reads-title">延伸阅读</h2>
      <ul class="ai-related-reads-list">${items}</ul>
      ${trust}
    `;
  });
})();
