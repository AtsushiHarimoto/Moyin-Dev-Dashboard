# Claude Code Cross-Platform Configuration

## Files

- **claude-code-config.json**: Machine-readable configuration snapshot from Windows 11
- **SYNC_INSTRUCTIONS.md**: Execution protocol for target Claude Code instance
- **README.md**: This file

## Usage on Target Machine (Mac/Linux)

### Step 1: Transfer Config
Copy this `config/` directory to target machine:
```bash
# On target machine
cd /path/to/Moyin/tools/skills-switch/config
```

### Step 2: Execute Sync
Open Claude Code on target machine and provide:
```
读取 tools/skills-switch/config/claude-code-config.json 和 SYNC_INSTRUCTIONS.md，
评估当前 OS 环境，生成同步方案，并等待我的确认。
```

### Step 3: Review Plan
Claude Code will:
1. Detect target OS (darwin/linux)
2. Analyze compatibility
3. Propose OS-specific adaptations
4. Present sync plan

### Step 4: Approve/Reject
User decides whether to proceed with sync.

## What Gets Synced

✅ **Plugins** (with version matching)
✅ **Hooks** (with OS-native adaptations)
✅ **User settings** (model, permissions, effortLevel)
✅ **Project structure** (.claude/scripts/, .claude/hooks/)

❌ **Skills** (excluded as per user request)
❌ **Session history**
❌ **Cache files**

## OS Adaptations

### Notification Hook
- **Windows**: PowerShell Toast (Windows.UI.Notifications)
- **macOS**: AppleScript osascript display notification
- **Linux**: notify-send (libnotify)

All three achieve same functional outcome: OS-native notification on session stop.

## Safety

- Non-destructive: Backs up before changes
- Testable: Dry-run mode available
- Reversible: Rollback on failure
- User-controlled: Requires explicit approval
