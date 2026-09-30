# uperms

A self-contained permission system for KCDC servers. It offers hierarchical permission
nodes, groups with inheritance, allow and deny rules, time-limited grants and pluggable
conditions, exposed to other scripts through a small export API and managed in game with
the `/uperms` command. Data is persisted either to a JSON file or to MySQL, selected in
`config.json`.

uperms has no dependencies on other resources and works out of the box.

## Contents

- [Concepts](#concepts)
- [Rule evaluation](#rule-evaluation)
- [Conditions](#conditions)
- [API](#api)
- [Commands](#commands)
- [Configuration](#configuration)
- [Persistence](#persistence)
- [MySQL setup](#mysql-setup)
- [Development](#development)

## Concepts

| Term | Description |
| --- | --- |
| **Node** | A dot-separated identifier such as `admin.kick`. A trailing wildcard (`job.*`) matches every node below `job`, but not `job` itself. `*` matches every node. |
| **Subject** | Any entity that can hold permissions. Players are addressed as `player:<steamId>`. Arbitrary identifiers such as `faction:guards` or `door:north-gate` are supported as well. |
| **Group** | A named set of rules that can inherit from parent groups. The `default` group applies to every subject. |
| **Rule** | `{ node, effect: "allow" \| "deny", when?, expires? }` |
| **Owner** | A SteamID listed in `owners` in `config.json`. Owners hold every permission, cannot be restricted, and remain fully functional while storage is unavailable. They are the bootstrap for managing everyone else. |

## Rule evaluation

To answer a query, uperms gathers the rules of the subject, of its groups and of their
parent groups. Rules whose node does not match, whose expiry has passed or whose conditions
fail are discarded. The remaining rules are ordered by:

1. **Specificity** of the node: `a.b.c` before `a.b.*` before `a.*` before `*`.
2. **Proximity** of the source: the subject itself, then its groups, then their parents.
3. **Effect**: `deny` before `allow`.

The first rule in this order decides. If no rule applies, access is denied. Queries are
answered synchronously from memory.

## Conditions

A rule may carry a `when` object that maps condition names to arguments. Every entry must
pass for the rule to apply. Unknown conditions, and conditions that throw, cause the rule
not to apply.

The built-in `ctx` condition requires each listed key to equal the corresponding value in
the context passed to the query:

```ts
grant("system", "player:76561190000000000", "job.guard.arrest", { when: { ctx: { onDuty: true } } });

can(player, "job.guard.arrest", { onDuty: true });  // true
can(player, "job.guard.arrest", { onDuty: false }); // false
```

Additional conditions are registered at runtime:

```ts
registerCondition("night", (argument, ctx, subject) => (ctx.hour >= 20) === argument);
```

## API

All functions are available through `Exports.get("uperms", <name>)`.

| Function | Description |
| --- | --- |
| `can(who, node, ctx?)` | Returns `true` if the subject holds the permission. |
| `check(who, node, ctx?)` | Returns `{ allowed, reason }`, including the rule that decided. |
| `require(who, node, ctx?)` | Throws `Missing permission: <node>` if the subject does not hold the permission. |
| `grant(actor, who, node, options?)` | Sets a rule on a subject. Options: `effect`, `when`, `expires` (Unix ms). |
| `revoke(actor, who, node)` | Removes a subject's rule for a node. |
| `addToGroup(actor, who, group, expires?)` | Adds a subject to a group, optionally time-limited. |
| `removeFromGroup(actor, who, group)` | Removes a subject from a group. |
| `registerCondition(name, fn)` | Registers a condition for use in `when`. |
| `getGroups()`, `getSubject(who)` | Read access to groups and subjects. |
| `isReady()` | Returns `true` once stored data has been loaded. |

`who` is either a player (any object with a `steamId`) or a subject identifier string.
`actor` is a label that is recorded in the audit log.

Consumers can treat uperms as optional:

```ts
let can = (player: Player, node: string): boolean => false;
try { can = Exports.get("uperms", "can") as typeof can; } catch { /* uperms is not installed */ }
```

To guarantee that uperms starts first, list it in the consumer's `resourceDependencies`.

## Commands

All commands require the `uperms.manage` permission. A permission can only be granted by
someone who holds it, and group membership additionally requires `uperms.group.<group>`,
so nobody can hand out more than they have.

```
/uperms check <id> <node>
/uperms info <id>
/uperms groups
/uperms audit
/uperms grant <id> <node> [allow|deny] [duration]
/uperms revoke <id> <node>
/uperms group add|remove <id> <group> [duration]
/uperms group create <name> [parent]
/uperms group delete <name>
/uperms group parent <name> <parent|->
/uperms group grant <name> <node> [allow|deny]
/uperms group revoke <name> <node>
```

`<id>` is the numeric player id. A duration is a number followed by `m`, `h` or `d`
(for example `30m`, `2h`, `7d`).

## Configuration

`config.json` in the resource directory:

| Key | Default | Description |
| --- | --- | --- |
| `owners` | `[]` | SteamIDs with unrestricted access. |
| `storage` | `"json"` | `"json"` (stored in `data/uperms.json`) or `"mysql"`. |
| `defaultGroup` | `"default"` | Group that every subject inherits from. |
| `commandPrefix` | `"uperms"` | Name of the chat command. |
| `mysql.table` | `"uperms_data"` | Table name (letters, digits and `_`). |
| `mysql.connectionLimit` | `10` | Maximum pool size, limited to 1-50. |
| `mysql.slowQueryWarningMs` | `150` | Logs queries slower than this. `0` disables the warning. |
| `mysql.debug` | `false` | Logs every query. |

## Persistence

- Changes take effect in memory immediately and are written to storage in order in the
  background. If a write fails, the failure is logged and the next change writes the
  complete state again.
- If stored data cannot be loaded (corrupt file, database unreachable, missing driver),
  uperms starts in a degraded mode: only owners are authorized, modifications are rejected
  and loading is retried every 15 seconds. Stored data is never replaced by an empty set.
- When the resource stops, pending writes are completed and the database pool is closed.

## MySQL setup

1. Run `npm install` in the resource directory on the server. KCDC does not install a
   resource's packages automatically. The `mysql2` driver is loaded on demand, so a missing
   installation results in a clear log message and a degraded start rather than a crash.
2. Provide the connection string through the environment, not through a file. Use
   `UPERMS_MYSQL_CONNECTION_STRING`, or `MYSQL_CONNECTION_STRING` if it is shared. Both
   `mysql://user:password@host:3306/database` (with special characters percent-encoded) and
   `host=...;port=...;database=...;user=...;password=...` are accepted.
3. Set `"storage": "mysql"` in `config.json`. The table is created on first start.

The complete document is stored in a single row. Queries are issued through the driver
directly, so a failed query raises an error and is never interpreted as missing data.
Timestamps use UTC.

## Development

```
npm run build    # compile TypeScript to dist/
npm test         # build and run the test suite
npm run check    # type-check only
```

The source is organized by responsibility:

| Module | Responsibility |
| --- | --- |
| `matcher` | Node pattern matching and specificity |
| `resolver` | Rule collection, inheritance and precedence |
| `conditions` | Condition registry and evaluation |
| `service` | State, mutations, validation and audit log |
| `storage`, `mysql-storage` | JSON and MySQL persistence |
| `commands` | The `/uperms` chat command |
| `index` | Wiring, exports and lifecycle |
