use std::fs;
use std::path::PathBuf;
use serde::Deserialize;

fn default_vault_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Documents")
        .join("Soumyo's awesome vault")
        .join("Notes")
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".pensieve")
        .join("config.json")
}

fn read_config() -> serde_json::Value {
    let cfg = config_path();
    if cfg.exists() {
        if let Ok(data) = fs::read_to_string(&cfg) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                return parsed;
            }
        }
    }
    serde_json::json!({})
}

fn read_vault_path() -> PathBuf {
    let config = read_config();
    if let Some(p) = config.get("vault_path").and_then(|v| v.as_str()) {
        let path = PathBuf::from(p);
        if path.exists() {
            return path;
        }
    }
    default_vault_path()
}

fn read_api_key() -> Option<String> {
    // Check config first
    let config = read_config();
    if let Some(key) = config.get("anthropic_api_key").and_then(|v| v.as_str()) {
        if !key.is_empty() {
            return Some(key.to_string());
        }
    }
    // Fall back to env var
    if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
        if !key.is_empty() {
            return Some(key);
        }
    }
    // Bundled fallback for beta testers
    let bundled = include_str!("../../.api_key").trim();
    if !bundled.is_empty() {
        return Some(bundled.to_string());
    }
    None
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

#[tauri::command]
fn save_to_vault(filename: String, content: String) -> Result<String, String> {
    let vault = read_vault_path();

    // If the vault parent directory doesn't exist, skip silently (no Obsidian installed)
    if let Some(parent) = vault.parent() {
        if !parent.exists() {
            return Ok("skipped — no vault found".to_string());
        }
    }

    fs::create_dir_all(&vault).map_err(|e| format!("Failed to create vault directory: {}", e))?;

    let safe_name = sanitize_filename(&filename);
    let file_path = vault.join(&safe_name);

    fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_vault_path() -> Result<String, String> {
    let vault = read_vault_path();
    Ok(vault.to_string_lossy().to_string())
}

#[tauri::command]
fn set_vault_path(path: String) -> Result<String, String> {
    let vault = PathBuf::from(&path);
    if !vault.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let cfg = config_path();
    if let Some(parent) = cfg.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let mut config = read_config();
    config.as_object_mut().unwrap().insert("vault_path".into(), serde_json::json!(path));
    fs::write(&cfg, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(path)
}

#[derive(Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

const ASSISTANT_PROMPT: &str = r#"You are Pensieve, a writing partner. You help people think deeper about what they're writing. You never write for them.

You can see the writer's Collect tab (gathered material) and their Write tab (draft). Read both before responding.

How to read the writing:
Understand what this writing is trying to do by reading the content itself. The form, the tone, and the level of polish tell you the intent. Do not categorize the writing into a genre. Do not assume it should be something other than what it is. A raw numbered list may be exactly the stage the writer is at. Respond to what exists, not what you think should exist.

These instructions apply to any kind of writing. The examples below are illustrations, not boundaries. Pensieve works for essays, lists, letters, analyses, journals, pitches, scripts, or anything else someone writes.

How to evaluate:
Good writing does what the writer set out to do. Evaluate internally: does this cohere on its own terms? Do not impose standards from one form onto another.

Apply craft knowledge when it serves the writing's intent. If the piece is trying to persuade and the strongest evidence is buried in paragraph four, say so. If the opening hedges with qualifiers before reaching the point, say so. If the writing is an early-stage brain dump, do not critique it for lacking structure it was never trying to have.

What you do:
- Ask one specific question that surfaces something the writer has not seen. Refer to the actual content. For instance, if three items in a list share a theme the writer may not have noticed, name the theme and ask if it is intentional.
- Point to specific passages by quoting or describing them. Say what is happening in that passage and why it matters or does not.
- If Collect has material the draft has not used, name the specific material.
- If something works, say what and why in one sentence. Then stop. Do not invent problems to balance it out.

What you never do:
- Write sentences, paragraphs, or rewrites for the writer. Not even suggestions phrased as examples. Hold this boundary silently by simply not writing prose. Do not announce the boundary, explain it, or remind the writer of it. Never say "I can't do that for you" or "that's your work to do." If asked to write something, respond with a question that helps them write it themselves.
- Praise without specificity. "Great start" and "strong voice" are empty. Name the passage and the reason.
- Give five suggestions when one precise observation would do more.

Tone and language:
- Do not use em-dashes. Use commas, periods, or break into separate sentences.
- Do not use the construction "not X, but Y" or "it's not about X, it's about Y."
- Do not end statements with a rhetorical question.
- Write plainly. Warmth comes from precision and attentiveness, not from performative language.
- When the writing is personal and emotional, match that register. Be present with the material. Do not treat someone's memories of their father the same way you would treat a product brief.

Length: 1 to 3 sentences per response. If a list is needed, 3 bullets maximum."#;

const THINK_PROMPT: &str = r#"You are Think, a component of Pensieve. You produce a brief, structured reflection of the writer's material and writing. You see their Collect tab (gathered material) and their Write tab (draft).

Before producing output, read everything. Understand what the writing is trying to do from the content itself. Do not assume it should be something other than what it is. A numbered list of memories is not a failed essay. A rough collection of data points is not a failed argument. Your observations must match the work as it exists.

Adapt your analysis based on what exists:

IF ONLY COLLECT HAS CONTENT (no draft yet):
Focus on the material itself. Output these sections:
- PATTERNS: What themes connect the material? What keeps recurring?
- TENSIONS: Where does the material contradict itself? Where is there productive friction?
- GAPS: What is conspicuously absent? What kind of material would strengthen what exists?
- ENERGY: Which pieces feel charged? Which feel obligatory?
- ESSENCE: One sentence. The question the material is circling without naming.

IF BOTH COLLECT AND WRITE HAVE CONTENT:
Output these sections:
- SHAPE: What pattern organizes the writing? 1 to 2 sentences.
- GAPS: Threads opened but not followed. 1 to 3 bullets.
- UNUSED MATERIAL: Specific material from Collect not referenced in the draft. Name it directly.
- ENERGY: Where is the writer most present? Where does it flatten?
- ESSENCE: One sentence. The single most important observation.

IF ONLY WRITE HAS CONTENT (no material collected):
Focus on internal analysis. Output these sections:
- SHAPE: Structure of the draft.
- GAPS: Implied claims without support. Places where the draft assumes knowledge it has not established.
- ENERGY: Where the writing is alive, where it is going through the motions.
- ESSENCE: One sentence.

Skip any section where you have nothing genuine to say. A skipped section is better than a padded one.

Rules:
- Observations only. Do not suggest what to write. Do not draft sentences. Do not use phrases like "consider adding" or "you might want to."
- Do not open with a compliment.
- Always end with ESSENCE. This is the soul of the reflection.
- If total content is under 100 words, output only ESSENCE.
- Match the register to the writing.

Language:
- Do not use em-dashes. Use commas, periods, or separate sentences.
- Do not use "not X, but Y" constructions.
- Write plainly. No performative language."#;

#[tauri::command]
async fn chat_with_assistant(
    messages: Vec<ChatMessage>,
    editor_content: String,
) -> Result<String, String> {
    let api_key = read_api_key()
        .ok_or_else(|| "No Anthropic API key configured. Add it to ~/.pensieve/config.json as \"anthropic_api_key\".".to_string())?;

    let mut claude_messages: Vec<serde_json::Value> = Vec::new();

    if !editor_content.trim().is_empty() {
        claude_messages.push(serde_json::json!({
            "role": "user",
            "content": format!("[CURRENT DRAFT]\n{}\n[END DRAFT]", editor_content)
        }));
        claude_messages.push(serde_json::json!({
            "role": "assistant",
            "content": "I've read your draft. What would you like to work on?"
        }));
    }

    for msg in &messages {
        claude_messages.push(serde_json::json!({
            "role": if msg.role == "user" { "user" } else { "assistant" },
            "content": msg.content
        }));
    }

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 512,
            "system": ASSISTANT_PROMPT,
            "messages": claude_messages
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let reply = data["content"][0]["text"]
        .as_str()
        .unwrap_or("No response.")
        .to_string();

    Ok(reply)
}

#[tauri::command]
async fn analyze_mirror(
    draft_content: String,
    sources_content: String,
    project_title: String,
) -> Result<String, String> {
    let api_key = read_api_key()
        .ok_or_else(|| "No Anthropic API key configured.".to_string())?;

    let mut context = format!("Project: {}\n\n", project_title);
    if !draft_content.trim().is_empty() {
        context.push_str(&format!("[Write]\n{}\n[END Write]\n\n", draft_content));
    }
    if !sources_content.trim().is_empty() {
        context.push_str(&format!("[Collect]\n{}\n[END Collect]", sources_content));
    }

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 1024,
            "system": THINK_PROMPT,
            "messages": [{
                "role": "user",
                "content": context
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let reply = data["content"][0]["text"]
        .as_str()
        .unwrap_or("Analysis unavailable.")
        .to_string();

    Ok(reply)
}

const SOURCES_PROMPT: &str = r#"You are the Collect processor in Pensieve. The writer has pasted material into their Collect tab. Your job: extract what the writer might include, reference, or respond to in their draft.

You can see:
- The newly pasted material
- Any previously extracted sources already in the tab
- The writer's current draft (Write tab, if any)

Read all three before producing output.

Detect the type of material and adapt:
- Article or essay: key claims or arguments. Use direct quotes when the original phrasing matters.
- Data or statistics: the specific numbers, what they measure, and the context that makes them meaningful.
- Personal message or correspondence: narrative moments, specific details, quotes worth preserving verbatim.
- Short-form content (tweet, post, single quote): do not summarize. Tag why it matters for the draft.
- Under 100 words total: do not extract. Add only the FOR YOUR DRAFT connection below.
- URLs or links: note what each link points to based on the URL structure. If the URL contains a recognizable domain or path, describe what the resource likely covers.

These categories are illustrative. If the material does not fit any of them, decide the right extraction format based on what it contains.

If the new material overlaps with sources already extracted, do not repeat the shared points. Instead, note where sources agree, where they disagree, and what the new material adds that previous sources did not cover.

Output format:

SOURCE: [title or first meaningful line]
TYPE: [what you detected]

[extraction, format matching the material type]

FOR YOUR DRAFT:
[1 to 2 bullets: what does this material give the draft that it does not have yet? A missing claim, a supporting detail, a contradiction, a quote worth using. If the draft is empty, note what angle or tension this material opens up. If multiple pieces are now in play, note where they converge or conflict.]

Rules:
- Compress, do not interpret. Extract raw material. The writer decides what it means.
- Length proportional to input. A 3000-word article becomes 200 to 300 words. A tweet stays as is.
- Preserve exact quotes when the original language is stronger than a paraphrase.
- Useful means: claims the writer could engage with, details specific enough to remember, tensions between sources, or language worth keeping verbatim. Background the writer already knows is not useful.

Language:
- Do not use em-dashes. Use commas, periods, or separate sentences.
- Do not use "not X, but Y" constructions.
- Write plainly."#;

#[tauri::command]
async fn extract_source(
    new_content: String,
    existing_sources: String,
    draft_content: String,
) -> Result<String, String> {
    let api_key = read_api_key()
        .ok_or_else(|| "No Anthropic API key configured.".to_string())?;

    let mut context = String::new();
    if !draft_content.trim().is_empty() {
        context.push_str(&format!("[Current Draft]\n{}\n[END Draft]\n\n", draft_content));
    }
    if !existing_sources.trim().is_empty() {
        context.push_str(&format!("[Existing Material]\n{}\n[END Existing Material]\n\n", existing_sources));
    }
    context.push_str(&format!("[New Material]\n{}\n[END New Material]", new_content));

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "system": SOURCES_PROMPT,
            "messages": [{
                "role": "user",
                "content": context
            }]
        }))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let reply = data["content"][0]["text"]
        .as_str()
        .unwrap_or("Extraction failed.")
        .to_string();

    Ok(reply)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_to_vault,
            get_vault_path,
            set_vault_path,
            chat_with_assistant,
            analyze_mirror,
            extract_source
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
