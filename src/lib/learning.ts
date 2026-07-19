/**
 * Background auto-learning utility.
 * Asynchronously extracts rules from dialogue and persists them to Coach Memory.
 */
export async function triggerAutoLearning(chatLog: any[], session: any): Promise<string | null> {
  if (!chatLog || chatLog.length < 2) return null;
  
  try {
    // Only pass role and content fields
    const formattedMessages = chatLog.map(m => ({
      role: m.role,
      content: m.content
    }));

    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "extract_lesson",
        messages: formattedMessages
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const ruleText = (data.message || "").trim();

    if (!ruleText || ruleText === "NO_RULE") return null;

    // Persist to Memory Bank
    if (session?.user) {
      const saveRes = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: ruleText })
      });
      if (saveRes.ok) {
        return ruleText;
      }
    } else {
      // Local Storage fallback
      const currentTactics = JSON.parse(localStorage.getItem("poke_learned_tactics") || "[]");
      if (!currentTactics.some((t: any) => t.rule_text === ruleText)) {
        currentTactics.unshift({
          id: Math.random().toString(36).substring(2, 11),
          rule_text: ruleText,
          is_active: true,
          created_at: new Date().toISOString()
        });
        localStorage.setItem("poke_learned_tactics", JSON.stringify(currentTactics));
        return ruleText;
      }
    }
  } catch (err) {
    console.warn("[Auto-Learning] Background lesson extraction failed (non-fatal):", err);
  }
  return null;
}
