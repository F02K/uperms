import type { EventHandler, MessageHandler, MessageReply, Quaternion, Unsubscribe, Vector3 } from "../shared.js";

declare global {
  /**
   * Native events dispatched through `Events.on`. Each property is the exact callback argument tuple for that event.
   */
  interface EventMap {
    /**
     * Dispatched once a connecting player's body exists and can be resolved to a handle. The body has no pose yet -- `player.ready` is false until the owner reports one.
     */
    playerConnect: [player: Player];

    /**
     * Dispatched while a player is leaving, before their body is destroyed, so the handle still reads. Anything keyed on the player must be cleaned up here: a dropped connection raises no other event.
     */
    playerDisconnect: [player: Player];

    /**
     * Dispatched once per accepted death report. Call player.revive() to request revival; there is no automatic respawn.
     * 
     * `killer` is the player whose blow took the last of the health, as the dying player's own client saw it -- null for a fall, a bleed-out, or anything that was not a player. `reason` is the game's own for that last write: `combat` for a blade or a bow, `fall`, `bleeding`, `poison` and so on.
     */
    playerDied: [player: Player, killer: Player | null, reason: "unknown" | "combat" | "gunshot" | "starvation" | "collision" | "scripted" | "disintegrate" | "fall" | "poison" | "bleeding" | "selfHarm"];

    /**
     * Dispatched when something takes health off a player: a weapon, an arrow, a fall, a collision, a scripted hit. The hit player's own client reports it, because only it resolved the blow against its armour and its skills, so `amount` is what was really taken. It arrives ahead of the `playerDied` a killing blow causes.
     * 
     * `attacker` is the player who dealt it, or null. `bodyPart` is where it landed, or null for damage that lands nowhere in particular. The weapon is the attacker's own `rightHandItem` or `leftHandItem`.
     * 
     * Bleeding, poison and hunger wear health down a tick at a time without raising this -- `bleeding`, `poisoning` and `hunger` are live numbers already. The tick that kills does arrive, with its own reason, just before the `playerDied` it causes.
     */
    playerDamage: [player: Player, attacker: Player | null, amount: number, bodyPart: "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | null, reason: "unknown" | "combat" | "gunshot" | "starvation" | "collision" | "scripted" | "disintegrate" | "fall" | "poison" | "bleeding" | "selfHarm"];

    /**
     * Dispatched when a limb becomes injured -- usually a blow landing there, sometimes a fall on both legs. `player.injuries` already says so. A limb hit again while injured stays injured and raises nothing new.
     */
    playerInjured: [player: Player, bodyPart: "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg"];

    /**
     * Dispatched when a limb injury is gone: it healed by itself, a bandage took it, or `player.heal` did.
     */
    playerInjuryHealed: [player: Player, bodyPart: "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg"];

    /**
     * Dispatched when a player's body needs somewhere to stand, while their own client waits on the answer behind its loading screen. This is the one moment a spawn can be chosen without anybody seeing the body move -- call `player.spawn(position)` from the handler and that becomes where they arrive.
     * 
     * Handlers run synchronously, so the choice has to be made in the handler itself rather than in something awaited from it. A handler that names no placement leaves the player at the level's own start point, which is the same tile for everybody.
     * 
     * `reason` says whether they are arriving or coming back: `join` for a connection, `respawn` after a death.
     */
    playerSpawning: [player: Player];

    /**
     * Dispatched once a joining player is really standing in the world: their level is up, their body is where `playerSpawning` put it, and the ground under it has loaded. Anything that acts on an arriving player -- kit, a welcome line, a marker -- belongs here rather than in `playerConnect`, which fires while they are still loading the level, or in `playerSpawning`, where the body is still mid-placement.
     */
    playerSpawned: [player: Player];

    /**
     * Dispatched immediately after a horse is created and replicated, whether by `Horse.spawn`, the `/horse` command, or anything else.
     */
    horseSpawn: [horse: Horse];

    /**
     * Dispatched while a horse is being despawned. The handle still resolves, so its rider and name can be read one last time.
     */
    horseDestroy: [horse: Horse];

    /**
     * Dispatched after a player climbs into a saddle and the horse's authority has been handed to their client.
     */
    horseMount: [horse: Horse, player: Player | null];

    /**
     * Dispatched after a rider leaves a saddle, including the dismount a disconnect implies, the one a destroyed or dead horse forces, and the one a rider's own death forces.
     */
    horseDismount: [horse: Horse, player: Player | null];

    /**
     * Dispatched when a player has climbed into a saddle, before the server accepts it -- the place to decide who may ride which horse. Return `false` from a handler and the ride is refused: the player's client is told to get back off, and no `horseMount` follows. Handlers run synchronously, so the decision cannot wait on anything awaited.
     * 
     * The player's own game has already started the mount when this runs, so a refusal plays the get-off.
     */
    horseMounting: [horse: Horse, player: Player];

    /**
     * Dispatched when health comes off a horse: a blade, an arrow, a fall. The client running the horse reports it, because its copy of the animal is the one whose soul counts -- a blow resolved on the attacker's machine is handed to it first -- so `amount` is what was really taken. `attacker` is the player who dealt it, or null.
     */
    horseDamage: [horse: Horse, attacker: Player | null, amount: number, reason: "unknown" | "combat" | "gunshot" | "starvation" | "collision" | "scripted" | "disintegrate" | "fall" | "poison" | "bleeding" | "selfHarm"];

    /**
     * Dispatched once when a horse dies, whatever killed it: its body falls where it stood, and anyone in the saddle has already been taken off (with a `horseDismount`). `killer` is the player whose blow took the last of the health, or null. It follows the `horseDamage` of the blow that caused it: the client running the horse reports both, in that order.
     */
    horseDeath: [horse: Horse, killer: Player | null, reason: "unknown" | "combat" | "gunshot" | "starvation" | "collision" | "scripted" | "disintegrate" | "fall" | "poison" | "bleeding" | "selfHarm"];

    /**
     * Dispatched when a player picks an option. The option's own id comes back, never its index, so a handler stays correct when the page is rebuilt with different rows. Anything the option costs is checked here, not when the page was built: `enabled` on the wire is a rendering hint and the server is what decides.
     */
    dialogueChoice: [session: number, player: Player, optionId: string];

    /**
     * Dispatched when a conversation ends, whoever ended it. 0 completed, 1 the player cancelled, 2 another conversation replaced it, 3 it was interrupted -- a disconnect, most often.
     */
    dialogueClosed: [session: number, player: Player, reason: number];

    /**
     * Dispatched once a deal has settled: everything in it has already moved. `balance` is what the player came out with in money units -- positive when the vendor paid them. What the player sold does not join the vendor's stock; add it with `setStock` here if this vendor resells.
     */
    vendorTrade: [vendor: number, player: Player, bought: VendorTradeLine[], sold: VendorTradeLine[], balance: number];

    /**
     * Dispatched when a trading session ends, whoever ended it. 0 the player closed the screen, 1 the server closed it, 2 another vendor replaced it, 3 the client could not bring the screen up, 4 the player left.
     */
    vendorClosed: [vendor: number, player: Player, reason: number];

    /**
     * Dispatched immediately after a dog is created and replicated, whether by `Dog.spawn` or anything else.
     */
    dogSpawn: [dog: Dog];

    /**
     * Dispatched while a dog is being despawned. The handle still resolves, so its owner and name can be read one last time.
     */
    dogDestroy: [dog: Dog];

    /**
     * Dispatched after a dog is handed to another player, or left masterless.
     */
    dogOwnerChanged: [dog: Dog, player: Player | null];

    /**
     * Dispatched after a dog's companion mode actually changes.
     */
    dogModeChanged: [dog: Dog, mode: number];

    /**
     * Dispatched immediately after a prop is created and replicated, whether by `Prop.spawn`, the `/prop` command, or anything else.
     */
    propSpawn: [prop: Prop];

    /**
     * Dispatched while a prop is being despawned. The handle still resolves, so its model and its pose can be read one last time.
     */
    propDestroy: [prop: Prop];

    /**
     * Dispatched immediately after a replicated particle effect is placed, whether by `Vfx.spawn`, a command, or anything else.
     */
    vfxSpawn: [vfx: Vfx];

    /**
     * Dispatched while a replicated particle effect is being stopped. The handle still resolves, so its name and its pose can be read one last time.
     */
    vfxDestroy: [vfx: Vfx];

    /**
     * Dispatched immediately after a ground marker is drawn, whether by `Marker.place`, a command, or anything else.
     */
    markerPlace: [marker: Marker];

    /**
     * Dispatched while a ground marker is being removed. The handle still resolves, so its material and its pose can be read one last time.
     */
    markerRemove: [marker: Marker];

    /**
     * Dispatched when a player walks into a marker whose `trigger` is on. The client detects the crossing and the server confirms it against the position it already replicates, so a claim it does not agree with never reaches here.
     */
    markerEnter: [marker: Marker, player: Player];

    /**
     * Dispatched when a player walks out of a marker whose `trigger` is on. Not raised when the marker is removed, when `trigger` is turned off, or when the player leaves the world -- none of those is the player walking out.
     */
    markerExit: [marker: Marker, player: Player];

    /**
     * Dispatched immediately after an NPC is spawned or adopted, whether by `Npc.create`, a command, or anything else.
     */
    npcSpawn: [npc: Npc];

    /**
     * Dispatched while an NPC is being despawned. The handle still resolves, so what it was and where it stood can be read one last time.
     */
    npcDestroy: [npc: Npc];

    /**
     * Dispatched when an NPC finishes what it was told to do. `status` is `reached` when it arrived, `blocked` when it could not make progress, or `failed` when the order could not be carried out at all. A patrol steps on this event, so a handler that re-orders the NPC here replaces the route rather than racing it.
     */
    npcIntentDone: [npc: Npc, status: string];

    /**
     * Dispatched after health came off the ledger. The attacker's own client resolved the hit and the server agreed to it, so `amount` is what was actually taken, not what was claimed.
     */
    npcDamage: [npc: Npc, attacker: Player | null, amount: number];

    /**
     * Dispatched when the last of an NPC's health goes. The body stays as a corpse and the handle keeps resolving.
     */
    npcDeath: [npc: Npc, attacker: Player | null];

    /**
     * Dispatched when a dead NPC is brought back. Every client makes a new body for it.
     */
    npcRevive: [npc: Npc];

    /**
     * Dispatched when a player presses use on an NPC whose `interactable` is on. The client reports the press and the server confirms the distance against the position it already replicates, so a claim it does not agree with never reaches here.
     */
    npcInteract: [npc: Npc, player: Player];

    /**
     * Dispatched when the client running an NPC changes -- somebody walked into range, out of it, or disconnected. `player` is null when it went dormant. Nothing about the NPC changes with it: intent, ledger and identity are the server's, and the new simulator re-derives from them.
     */
    npcSimulatorChange: [npc: Npc, player: Player | null];

    /**
     * Dispatched when a player starts or stops following a quest in the game's journal, whichever way it happened: the track button, the game auto-tracking a quest that turns active, or the untrack that follows finishing or failing one. The client reports it -- following a quest is decided there and cannot be refused here -- so a handler reacts rather than vetoes. It fires only on an actual change, and only for a quest that player was given.
     */
    questTrackingChanged: [quest: Quest, player: Player, tracked: boolean];

    /**
     * Dispatched immediately after a stack is laid in the world and replicated, whether by `GroundItem.spawn`, the `/drop` command, or a player dropping something from their own inventory.
     */
    groundItemSpawn: [groundItem: GroundItem];

    /**
     * Dispatched while a stack is being taken out of the world, including the removal a completed pickup performs. The handle still resolves, so its item and its pose can be read one last time.
     */
    groundItemDestroy: [groundItem: GroundItem];

    /**
     * Dispatched when a player's pickup has been granted and the stack is about to go, so what was taken and by whom can both still be read. It reports a pickup rather than deciding one -- the server has already told that client the stack is theirs by the time this is raised -- and `groundItemDestroy` follows it.
     */
    groundItemPickup: [groundItem: GroundItem, player: Player | null];

    /**
     * Dispatched when a player's client reports working a door, before the server applies it. `action` is `open`, `close`, `lock`, `unlock` or `lockpick`; a key turned in the same use as the push arrives as `unlock` and then `open`. `keySide` says whether the player stood on the side with the keyhole, which is where an unlock needs a key.
     * 
     * Return false to refuse it: the door is put back on every client, the player's included, and nobody else sees it happen. Every handler runs whatever an earlier one returned, and an async handler cannot refuse. The server has already refused what the game's own rules forbid -- a player out of reach, a door the server locked, opening a locked door, picking a door with no keyhole -- so this only sees what the game would allow.
     */
    doorInteract: [player: Player, door: Door, action: "open" | "close" | "lock" | "unlock" | "lockpick", keySide: boolean];

    /**
     * Dispatched when a player submits a plain chat line. Turn `Chat.setDefaultRelay(false)` off to own delivery yourself.
     */
    playerChat: [player: Player, text: string];

    /**
     * Dispatched when a player's chat line begins with `/` and no built-in command claimed it. A `/` line is never relayed to anyone else.
     */
    playerCommand: [player: Player, command: string, args: string[]];

    /**
     * Dispatched when the world clock crosses midnight, whether it walked over or `World.setTime` jumped past. The day it carries is the one that just began.
     */
    worldDayChange: [day: number];

    /**
     * Dispatched when the sky starts blending to another time-of-day preset, from `World.setWeather` or the `/world weather` command. It is raised when the blend starts, not when it settles.
     */
    worldWeatherChange: [preset: string, previous: string, seconds: number];

    /**
     * Dispatched when a status effect appears on a player's body. `source` says whether this server added it; `native` means the game did -- a potion they drank, an injury they took. It fires for whatever they are already carrying when their client first reports in, so a handler sees the full picture without asking for it.
     */
    playerBuffAdded: [player: Player, buff: string, source: "server" | "native"];

    /**
     * Dispatched when a status effect leaves a player's body. `server` is a removal this server asked for; `expired` is everything else -- it ran out, or the game replaced it. Effect timers run on each player's own machine, so the server never expires one itself.
     */
    playerBuffRemoved: [player: Player, buff: string, reason: "server" | "expired"];

    /**
     * Dispatched when the game tried to give a player an effect of a kind this server claimed, and their client turned it down. This is the other half of `Buffs.claim`: the drink was still drunk and the item still consumed, so the handler decides what really happens -- usually `player.addBuff` with the resource's own rule applied. Nothing raises it until something is claimed, and repeats of the same effect are limited to twice a second per player.
     */
    playerBuffBlocked: [player: Player, buff: string];

    /**
     * Dispatched after a resource entry point has run and immediately before the resource becomes running.
     */
    resourceStart: [resourceName: string];

    /**
     * Dispatched while a resource is stopping, before its stop callback, timers, exports and event handlers are cleaned up.
     */
    resourceStop: [resourceName: string];

    /**
     * Dispatched when one key of an entity's state changes: on the server when a script writes it, on a client when the write arrives. `value` is undefined when the key was removed and `previous` is undefined when it held nothing before, so a stored null stays distinguishable from an absent key. The entity is whatever the game's WrapScriptEntity answers, and the base Entity handle by default.
     */
    entityStateChange: [entity: Entity, key: string, value: any, previous: any];
  }

  /** Names of native events available in this scripting environment. */
  type EventName = keyof EventMap;

  /**
   * How a player's body looks: four of the game's own character-component names, and the gender whose catalog they come from.
   * 
   * A part left out, or set to an empty string, means "leave that one alone" -- the body keeps whatever it would have had. An appearance with every part empty is the default body, which is what everyone wears until something chooses otherwise.
   */
  interface Appearance {
    /**
     * Which half of the game's character-component tree the four names come from. Not one of the four: a body's gender comes from its soul, and a name from one tree means nothing under the other, so this travels with them and is applied first.
     */
    gender: "male" | "female";

    /**
     * The skin: complexion and build. One of `Appearances.options("body", gender)`, or empty.
     */
    body: string;

    /**
     * The face. One of `Appearances.options("head", gender)`, or empty.
     */
    head: string;

    /**
     * The hairstyle, including its colour -- the game ships each style recoloured rather than colouring one. One of `Appearances.options("hair", gender)`, or empty.
     */
    hair: string;

    /**
     * The beard. Male only -- the female tree has none -- and one of `Appearances.beards(head)`, or empty.
     * 
     * Not every beard goes with every face: they are modelled per head, and a body asked for a pair that was never modelled refuses the whole appearance rather than quietly losing the beard.
     */
    beard: string;
  }

  /**
   * One entry of the game's character-component tree: something a body can be given for one part.
   */
  interface AppearanceOption {
    /**
     * What to put in the part. This is the game's own node name.
     */
    name: string;

    /**
     * Which part it fills.
     */
    part: "body" | "head" | "hair" | "beard";

    /**
     * Which tree it came out of. An option is only valid on a body of the same gender.
     */
    gender: "male" | "female";

    /**
     * The option this one is a variation of, or null when it stands on its own. The game ships a hairstyle once per colour, all derived from the same style node, so grouping by this is what turns 262 hairstyles into a list somebody can read.
     */
    group: string | null;
  }

  /**
   * The three character attributes a body's soul carries, in the game's own units.
   */
  interface SoulStats {
    /**
     * Attribute value, or 0 while the body has published no soul.
     */
    strength: number;

    /**
     * Attribute value, or 0 while the body has published no soul.
     */
    agility: number;

    /**
     * Attribute value, or 0 while the body has published no soul.
     */
    vitality: number;
  }

  /**
   * The nine skills a hit or a draw is evaluated against, in the game's own units.
   */
  interface SoulSkills {
    /**
     * Skill level, or 0 while the body has published no soul.
     */
    fencing: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    survival: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    defense: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    sword: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    heavyWeapons: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    marksmanship: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    dagger: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    largeWeapons: number;

    /**
     * Skill level, or 0 while the body has published no soul.
     */
    unarmed: number;
  }

  /**
   * The pace rule a server puts on one player. Both halves default to off, and a call to `setMovementMode` states both of them.
   */
  interface MovementMode {
    /**
     * Whether walking, rather than jogging, is the pace this player keeps coming back to. A preference: they start each body walking and return to it after every sprint, and their own toggle key works normally in between.
     */
    walkByDefault: boolean;

    /**
     * Whether this player may not run or sprint at all. A rule rather than a preference: it holds the engine's own movement permissions, so the toggle key and the sprint key both stop raising the pace, and lifting it hands back whatever the body had before.
     */
    walkEnforced: boolean;
  }

  /**
   * Which of a player's limbs carry an injury, one flag per limb. An injury is the game's own: it lowers the stamina ceiling (`healthyStamina`), can bleed, and heals slowly by itself or at once with a bandage or `player.heal`.
   */
  interface Injuries {
    /**
     * Whether the head is injured.
     */
    head: boolean;

    /**
     * Whether the torso is injured.
     */
    torso: boolean;

    /**
     * Whether the left arm is injured.
     */
    leftArm: boolean;

    /**
     * Whether the right arm is injured.
     */
    rightArm: boolean;

    /**
     * Whether the left leg is injured.
     */
    leftLeg: boolean;

    /**
     * Whether the right leg is injured.
     */
    rightLeg: boolean;
  }

  /**
   * A connected KCDC player and the body they occupy.
   */
  class Player {
    /**
     * Creates a script wrapper for an existing connected player with this ID; it neither connects nor spawns anyone.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The name this player connected under, or an empty string once their body is gone.
     */
    readonly nickname: string;

    /**
     * Connection slot this player holds, or 65535 when unassigned. Stable for the length of the session and reused afterwards.
     */
    readonly playerIndex: number;

    /**
     * What this player's body looks like, as their own client last published it. Every part is empty until something chooses one, which is the default body -- and why everyone looks the same until a resource says otherwise.
     * 
     * Read back rather than assumed after `setAppearance`: the owning client is authoritative for its own body, so a new look appears here once they have actually put it on.
     */
    readonly appearance: Appearance;

    /**
     * Whether this player's body has both a pose and a soul, which is what everyone else waits for before spawning a puppet for them. False for the first moments of a connection.
     */
    readonly ready: boolean;

    /**
     * Whether this player has health left. False also while no soul has been published.
     */
    readonly alive: boolean;

    /**
     * Whether the body can be driven at all: alive, conscious and not asleep.
     */
    readonly canAct: boolean;

    /**
     * Health as a percentage from 0 to 100 -- what the nametag bar draws. Derived from the pair behind it, so it survives a maximum that changes.
     */
    readonly healthPercent: number;

    /**
     * Current health, in the game's own units. 0 while no soul has been published.
     */
    readonly health: number;

    /**
     * Health capacity, in the game's own units.
     */
    readonly maxHealth: number;

    /**
     * Current stamina, in the game's own units.
     */
    readonly stamina: number;

    /**
     * Stamina capacity, in the game's own units. Collapses to 0 for a tick around death, which is real rather than a bad read.
     */
    readonly maxStamina: number;

    /**
     * The stamina ceiling the body's injuries currently allow, which is at or below maxStamina.
     */
    readonly healthyStamina: number;

    /**
     * Current tiredness, in the game's own units.
     */
    readonly exhaust: number;

    /**
     * Tiredness capacity, in the game's own units.
     */
    readonly maxExhaust: number;

    /**
     * Current nourishment, in the game's own units.
     */
    readonly hunger: number;

    /**
     * Nourishment capacity, in the game's own units.
     */
    readonly maxHunger: number;

    /**
     * How heavily the body is bleeding; 0 when it is not.
     */
    readonly bleeding: number;

    /**
     * Sleepiness the game has accumulated for this body; above 0 means asleep.
     */
    readonly sleeping: number;

    /**
     * How conscious the body is; 0 is knocked out.
     */
    readonly consciousness: number;

    /**
     * How drunk the body is; 0 is sober.
     */
    readonly drunkenness: number;

    /**
     * How poisoned the body is; 0 is clean.
     */
    readonly poisoning: number;

    /**
     * Strength, in the game's own units.
     */
    readonly strength: number;

    /**
     * Agility, in the game's own units.
     */
    readonly agility: number;

    /**
     * Vitality, in the game's own units.
     */
    readonly vitality: number;

    /**
     * The same three attributes as the engine's relative values, which is what its own modifiers are expressed in.
     */
    readonly relativeStats: SoulStats;

    /**
     * The nine combat and survival skills a hit or a draw is evaluated against. Read as a whole rather than one at a time: the snapshot carries them together.
     */
    readonly skills: SoulSkills;

    /**
     * The same nine skills as the engine's relative values.
     */
    readonly relativeSkills: SoulSkills;

    /**
     * The velocity the body's own animation was driven by this frame, not the one its physics settled on.
     */
    readonly velocity: Vector3;

    /**
     * World-space direction the head and eyes are turned towards. Zero while the body has reported none.
     */
    readonly lookDirection: Vector3;

    /**
     * Whether the body is off the ground -- fallen or mid-jump -- as its own physics reports it, debounced past the flicker a stair step causes.
     */
    readonly inAir: boolean;

    /**
     * The engine's own locomotion pace tag -- walk, jog, sprint -- as its animation system picked it. Raw Mannequin tag ids; 255 means nothing is set.
     */
    readonly moveSpeedTag: number;

    /**
     * The engine's own movement direction tag. Raw Mannequin tag ids; 255 means nothing is set.
     */
    readonly moveDirTag: number;

    /**
     * The engine's own stance tag -- upright, sneaking, sitting, lying. Raw Mannequin tag ids; 255 means nothing is set.
     */
    readonly stanceTag: number;

    /**
     * Whether this player is crouched, as their own game's crouch action reports it. False once their body is gone.
     */
    readonly crouched: boolean;

    /**
     * The ragdoll physics profile the body is in, or 255 when it has none to report.
     */
    readonly physicsProfile: number;

    /**
     * Whether this player has their fists -- or their weapon -- up. Stays true after the arm comes down, which is how the engine holds it.
     */
    readonly fistsUp: boolean;

    /**
     * The arm guard in the engine's own levels: 0 arms down, 1 the guard a player holds.
     */
    readonly guard: number;

    /**
     * Which direction of the combat star this player is aiming at, as a row of the game's zone table, or -1 when they are aiming at none.
     */
    readonly combatZone: number;

    /**
     * Item class drawn in the right hand as 32 hex digits, or an empty string when the hand is empty. A class rather than an item: no engine-local identifier crosses the wire.
     */
    readonly rightHandItem: string;

    /**
     * Item class drawn in the left hand as 32 hex digits, or an empty string when the hand is empty.
     */
    readonly leftHandItem: string;

    /**
     * Item classes this player is wearing, each as 32 hex digits. What they actually have on rather than a preset, so a bare body reads as an empty array.
     */
    readonly equipment: string[];

    /**
     * Whether this player is in a saddle.
     */
    readonly mounted: boolean;

    /**
     * The horse this player is riding, or null when they are on foot.
     */
    readonly horse: Horse | null;

    /**
     * The dog companion this player has, or null when they have none. One dog per player, as in the game.
     */
    readonly dog: Dog | null;

    /**
     * The status effects on this player's body, as their own client last reported them: potions, poison, injury, drunkenness, illness, unconsciousness, and anything this server added. Perks and equipment effects are not in here -- they follow state that already replicates.
     * 
     * This is the list of *named effects*. For how drunk, poisoned, hurt or tired someone actually is, read `drunkenness`, `poisoning`, `bleeding`, `consciousness`, `hunger` and `exhaust` instead: those are live numbers and need no name to look up.
     * 
     * Empty until the player's client sends its first report, shortly after they connect; `playerBuffAdded` fires for whatever it was already carrying.
     */
    readonly buffs: BuffState[];

    /**
     * Which limbs are injured, as the player's own client last reported them -- the same report `buffs` reads, named by limb so nobody has to know the six buff names. All false until the first report arrives. `playerInjured` and `playerInjuryHealed` fire as a flag changes.
     * 
     * What an injury does is the game's own: a hurt head, torso or arm weakens its stats, a hurt leg takes away running and sprinting, and a badly hurt limb bleeds. Everybody else sees the consequences rather than the injury: the owner's slower pace, the lower stamina ceiling, bleeding, and the hurt gait the game plays once health is low. The game has no leg-specific limp animation, so there is nothing more to show.
     */
    readonly injuries: Injuries;

    /**
     * Formats this player handle for logging and debugging.
     * @returns The player's network entity ID and nickname.
     */
    toString(): string;

    /**
     * Requests revival of this player after playerDied.
     * @returns True when sent; false when disconnected, no death was reported, or revival was already requested.
     */
    revive(): boolean;

    /**
     * Puts this player somewhere, as a spawn rather than as a teleport: their client holds the body still until there is real ground under it, so it cannot fall through a world that has not streamed in yet.
     * 
     * Called from a `playerSpawning` handler this *is* the answer to that request -- the player is still behind their loading screen, and nothing is seen. Called at any other time it moves a player who is already in the world, which is visible.
     * 
     * Nothing else names a spawn: with no handler calling this, everybody arrives at the level's own start point, because every client asks the game for the identical map start.
     * @param position Where the body goes; a Vector3 or any object carrying x, y and z.
     * @param rotation Which way they face: a Quaternion, or a Vector3 of Euler degrees.
     * @returns True when the placement was accepted; false for a position that is not somewhere in the world, or a player with no connection to ask.
     */
    spawn(position: Vector3 | Partial<Vector3>, rotation?: Quaternion | Vector3): boolean;

    /**
     * Asks this player's own client to put them somewhere else. The owning client is authoritative for its body's pose, so this is a request that lands on their next frame rather than a write.
     * @param position World-space destination; a Vector3 or any object carrying x, y and z.
     * @param label Optional name for the destination, echoed back in the client's own teleport panel. Display only.
     * @returns True when the request went out; false when the position is not finite or the player has no connection to ask.
     */
    teleport(position: Vector3 | Partial<Vector3>, label?: string): boolean;

    /**
     * Asks this player's own client to wear a different body -- face, hair, beard and skin. The owning client is authoritative for its body, so this is a request that lands on their next frame rather than a write; read `player.appearance` back to see what they actually put on.
     * 
     * Gender is applied before the parts, because it decides which half of the game's catalog the names come from -- and it is the one part of this with a price. A soul's gender lives on its archetype, so changing it moves the player to the game's own counterpart archetype, which also carries four authored numbers: base armour, the conspicuousness and visibility pair, and unarmed attack. Nothing reads those on the puppets other people see, but on the body its owner plays they are a real change. Ask for a gender only when you mean it; a male-to-male change never touches the archetype.
     * 
     * Everyone starts as Henry, so a server that wants people to tell each other apart has to call this.
     * 
     * Face and beard travel together whether or not both are named. Beards are modelled per face, so changing either into a pair that was never modelled is refused whole rather than applied without the beard; `Appearances.beards` says which pairs are real.
     * @param appearance The parts to change. Anything left out keeps what the player is wearing, and an empty string hands that part back to the game. Names come from `Appearances.options`, except the beard, which comes from `Appearances.beards`.
     * @returns True when the request went out; false for a name that is not in the catalog, a gender it does not belong to, a beard that face cannot wear, or a player with no connection to ask.
     */
    setAppearance(appearance: Partial<Appearance>): boolean;

    /**
     * Puts a pace rule on this player. `walkByDefault` makes walking the pace they keep coming back to and leaves their own key working; `walkEnforced` forbids running and sprinting outright, and their key stops mattering.
     * 
     * The two are different things and both are worth having: a default is a preference, an enforcement is a rule. Nothing about either goes out to anybody else -- the pace every other player draws comes from this body's own published animation tags, so a walking player already looks like one everywhere.
     * 
     * A default holds across sprints. The game itself ends every sprint in a jog, deliberately, so the client puts the walk back once the sprint is over rather than during it, and a player who chose to jog keeps jogging: only the pace the sprint took is given back. On a gamepad the stick's own deflection decides the pace, which the rule neither reads nor overrides.
     * 
     * Enforcement holds the engine's own run and sprint permissions, the same pair the game clears while somebody carries a body, and hands back what it found when the rule is lifted. Sprinting cannot shake it off.
     * @param mode The whole rule. A key left out is off, because the server keeps no copy of what this player is currently under.
     * @returns True when the rule went out; false for a player with no connection to ask.
     */
    setMovementMode(mode: Partial<MovementMode>): boolean;

    /**
     * Grants items into this player's inventory on their own client. The server holds no inventory of its own, so this is an instruction rather than a transfer.
     * @param item Item class GUID, or the exact name the game's own item tables use.
     * @param amount How many to grant; defaults to 1, and at most 10000.
     * @returns True when the grant went out; false for an unknown item or an amount the wire refuses.
     */
    giveItem(item: string, amount?: number): boolean;

    /**
     * Takes items back out of this player's inventory, on their own client -- the mirror of `giveItem`, and what makes a trade or a theft able to move in both directions.
     * 
     * It is a promise rather than a boolean because a grant always lands and a take may not. The server holds no inventory of its own, so it cannot know what the player is carrying: it asks their client, and the answer is a round trip away. Await it, and read `ok` before crediting the other side of a trade -- a player who has only one of the three you asked for gives back `removed: 1, ok: false`, and their client is already one short.
     * 
     * Across stacks of the same class, oldest first, and an item counts even while it is in the player's hand. Nothing else of theirs is touched.
     * @param item Item class GUID, or the exact name the game's own item tables use. The same spelling `giveItem` takes.
     * @param amount How many units to take; defaults to 1, and at most 10000. Zero is refused rather than read as "all of them".
     * @returns An object carrying `removed` (units that actually went), `requested` (what was asked for), `ok` (true only when the client answered and removed every unit), and `reason` (empty when it answered, otherwise what went wrong).
     */
    takeItem(item: string, amount?: number): Promise<{ removed: number; requested: number; ok: boolean; reason: string }>;

    /**
     * Puts a status effect on this player's body. The server runs no effects of its own, so this asks their client rather than writing anything, and it lands a moment later -- `hasBuff` right after this call still says false. Watch `playerBuffAdded` for the moment it is really on.
     * 
     * The ask is not a promise, either: the game refuses an effect that conflicts with one already there, and a second drink folds into the first rather than stacking.
     * @param buff Buff GUID, or the exact name the game's own buff tables use. `Buffs.find` resolves either.
     * @returns True when the instruction went out; false for an unknown buff or a player with no connection to ask.
     */
    addBuff(buff: string): boolean;

    /**
     * Asks this player's own client to take a status effect off: the exact instance when a report named one, and every instance of that definition otherwise.
     * @param buff Buff GUID, or the exact name the game's own buff tables use.
     * @returns True when the instruction went out; false for an unknown buff or a player with no connection to ask.
     */
    removeBuff(buff: string): boolean;

    /**
     * Clears every effect in one of the game's own families at once: one call for all poisons, or all bleeding, without naming them. `Buffs.tags` lists the families. Note that `World.setTime` does not fast-forward effects -- their time runs off each client's frame delta and never reads the calendar -- so a scripted sleep has to clear what it means to end.
     * @param tag An effect family, from `Buffs.tags` -- `poison`, `bleed`, `alcohol_drunk`, `unconscious`.
     * @returns True when the instruction went out; false for a tag no buff table uses or a player with no connection to ask.
     */
    clearBuffs(tag: string): boolean;

    /**
     * Whether this player's last report carried that status effect.
     * @param buff Buff GUID, or the exact name the game's own buff tables use.
     * @returns True when it did; false for an unknown buff, or a player who has reported nothing yet.
     */
    hasBuff(buff: string): boolean;

    /**
     * Nurses this player back, on their own client and with the game's own recipe -- the one its quests use for a full heal: the `remove_injuries` and `remove_all_posions` cures, which each wipe their whole kind of effect as they land, then health raised through the soul's own setter, the way a potion raises it. What comes off raises `playerInjuryHealed` and `playerBuffRemoved` as usual.
     * 
     * It does not revive anybody: a dead player stays dead until `revive`.
     * @param options What to restore; everything when left out. `health`: true or absent for all of it, a number to raise it to that much (never lowers it), false to leave it. `injuries`: clear every limb injury, and with it the bleeding a badly hurt limb causes. `poisons`: clear every poison. `bleeding`: clear the standalone bleeding effect.
     * @returns True when the orders went out; false for a player with no connection to ask. Throws for a health that is not a finite, non-negative number.
     */
    heal(options?: { health?: number | boolean; injuries?: boolean; poisons?: boolean; bleeding?: boolean }): boolean;

    /**
     * Takes this player out of whatever saddle they are in: their own client gets them off, and `horseDismount` is raised.
     * @returns The horse they were taken off, or null when they were not riding one.
     */
    dismount(): Horse | null;

    /**
     * Puts this player in a horse's saddle, the way the game's own forced mount does -- their client plays the climb. It is an instruction to their client, so the seat is reported back like any other mount: `horseMounting` can still refuse it, and `horseMount` and `player.horse` follow once it lands. The player has to be standing near the horse; teleport them beside it first.
     * @param horse The horse to climb onto.
     * @returns True when the order went out; false when the horse is dead or somebody else is riding it, or the player has no connection.
     */
    mount(horse: Horse): boolean;

    /**
     * Lists every player currently connected, including those whose body has no pose yet.
     * @returns One handle per connected player, in no particular order.
     */
    static all(): Player[];

    /**
     * Looks a player up by their network entity ID.
     * @param id Network entity identifier.
     * @returns The player's handle, or null when no connected player has that ID.
     */
    static getById(id: number): Player | null;
  }

  interface Player extends BasePlayer {}

  /**
   * Replicated KCD2 horse handle.
   */
  class Horse {
    /**
     * Creates a script wrapper for an existing horse with this ID; use Horse.spawn() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * GUID of the soul this horse was spawned against, which decides its appearance.
     */
    readonly soul: string;

    /**
     * Name every client shows for this horse. Assignment renames it on all of them; empty means the name its soul carries stands. A rider keeps the name it mounted with until it dismounts.
     */
    name: string;

    /**
     * What this horse can carry, in the game's own weight units, or 0 before any client has reported it. Derived by the engine, so read-only.
     */
    readonly inventoryCapacity: number;

    /**
     * Network ID of the player in the saddle, or 0 when the horse is riderless.
     */
    readonly riderId: number;

    /**
     * The player in the saddle, or null when the horse is riderless.
     */
    readonly rider: Player | null;

    /**
     * Whether a player is currently riding this horse.
     */
    readonly mounted: boolean;

    /**
     * Health, as the client running this horse last reported it off the animal's own soul -- 0 before any client has. Assigning sets it on that client, clamped to `maxHealth`; 0 kills. A dead horse ignores the write: `revive` is what brings one back.
     */
    health: number;

    /**
     * The most health this horse can have, from its soul; 0 before any client has run it.
     */
    readonly maxHealth: number;

    /**
     * Stamina, as its client last reported it -- the bar the game draws for a ridden horse, spent by galloping. Read-only: the game runs it.
     */
    readonly stamina: number;

    /**
     * The most stamina this horse can have; 0 before any client has run it.
     */
    readonly maxStamina: number;

    /**
     * False once the horse has died. A dead horse is still an entity: its body stays where it fell, nobody can ride it, and `revive` or `destroy` are the ways out.
     */
    readonly alive: boolean;

    /**
     * Formats this horse handle for logging and debugging.
     * @returns The horse ID, its soul, and its rider.
     */
    toString(): string;

    /**
     * Despawns this horse on every client after emitting horseDestroy.
     */
    destroy(): void;

    /**
     * Rears the horse on every client so it throws its rider off. The game's own animation, not a pose.
     * @returns True when the request went out; false when nobody is riding it.
     */
    rearAndThrowDown(): boolean;

    /**
     * Has a player pull this horse's rider down, on every client.
     * @param attacker The player dragging the rider out of the saddle.
     * @returns True when the request went out; false when nobody is riding it.
     */
    pullDownRider(attacker: Player): boolean;

    /**
     * Takes whoever is in the saddle out of it: their own client is told to get off, and `horseDismount` is raised.
     * @returns The player taken off, or null when the saddle was already empty.
     */
    dismountRider(): Player | null;

    /**
     * Kills this horse on the client running it, the way any other death happens there: the body falls, anyone riding it comes off, and `horseDeath` follows with a null killer and the reason `scripted`.
     * @returns True when the horse was alive; false when it was already dead.
     */
    kill(): boolean;

    /**
     * Brings a dead horse back where it lies, at its full health.
     * @returns True when the horse was dead; false when it was alive.
     */
    revive(): boolean;

    /**
     * Spawns and replicates a horse.
     * @param position Optional world-space spawn position; omitted components default to zero.
     * @param rotation Optional initial orientation: a Quaternion, or a Vector3 of Euler angles in degrees.
     * @param soul Optional breed from `Horse.breeds()` (`pebbles`), or a soul GUID from the game's tables; omitted spawns the generic riding horse.
     * @param name Optional name every client shows for the horse; omitted leaves the name its soul carries.
     * @returns The newly spawned horse handle.
     */
    static spawn(position?: Vector3 | Partial<Vector3>, rotation?: Vector3 | Quaternion, soul?: string, name?: string): Horse;

    /**
     * The horses `Horse.spawn` knows by name: every horse the game gives a character of its own -- the ones its traders sell and the named horses of its quests -- plus `horse`, the generic one.
     * @returns Breed names, `horse` first and the rest alphabetical.
     */
    static breeds(): string[];

    /**
     * Lists every horse the server currently has.
     * @returns One handle per live horse, in no particular order.
     */
    static all(): Horse[];

    /**
     * Looks a horse up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The horse's handle, or null when no live horse has that ID.
     */
    static getById(id: number): Horse | null;
  }

  interface Horse extends Entity {}

  /**
   * One row of a page.
   */
  interface DialogueOption {
    /**
     * What comes back on `dialogueChoice` when this row is picked. An id, never an index, so a handler stays correct when the page is rebuilt with different rows.
     */
    id: string;

    /**
     * The line the player reads. Server-authored text reaches the game's own list as written; it is not a localization key.
     */
    text: string;

    /**
     * Draws the row greyed and unpickable when false. A rendering hint only -- the server re-checks the choice when it arrives, so nothing a row costs may rely on this.
     */
    enabled: boolean | undefined;
  }

  /**
   * A line and the options under it.
   */
  interface DialoguePage {
    /**
     * Shown above the options. Omit it for a list with no preamble.
     */
    line: string | undefined;

    /**
     * Draws the list on the right of the screen instead of the left.
     */
    onRight: boolean | undefined;

    /**
     * The rows, at least one and at most eight. A page with none is refused.
     */
    options: DialogueOption[];
  }

  /**
   * Conversations the server drives on a player, in the game's own dialogue list.
   * 
   * A conversation is attached to nothing. It runs on a player and what it is about -- a smith, a notice board, a chest, a timer -- is this gamemode's own business, held in its own closures. That is deliberate and it has a cost: nothing here watches distance, line of sight or whether anyone died, because none of that is knowable without the relationship it refuses to hold. Close the conversation yourself when the fiction says it should end.
   */
  const Dialogue: {
    /**
     * Opens a conversation and shows its first page. A player already in one has it closed with reason 2 first, because the game has a single choice list and stacking them would lie about which is live.
     * @param player NetworkID of the player the conversation runs on.
     * @param page The first page. `options` is required and carries at most 8 rows; each needs an `id` and a `text`, and may set `enabled`. `line` and `onRight` are optional.
     * @returns The session id, or 0 when the page was unusable or the player is gone.
     */
    open(player: number, page: DialoguePage): number;

    /**
     * Replaces the page a live conversation is showing. Each page carries a generation the client echoes, so an answer still in flight against the page this replaces is dropped rather than misapplied.
     * @param session The session to advance.
     * @param page The page to show instead.
     * @returns False when that session has already ended.
     */
    update(session: number, page: DialoguePage): boolean;

    /**
     * Ends a conversation and takes the list off that player's screen.
     * @param session The session to end.
     * @returns False when the session had already ended.
     */
    close(session: number): boolean;

    /**
     * The conversation that player is in.
     * @param player NetworkID of the player to ask about.
     * @returns The session id, or 0 when they are not in one.
     */
    sessionOf(player: number): number;
  };

  /**
   * How a vendor starts out.
   */
  interface VendorOptions {
    /**
     * Shown in the server's log only. The trade screen names whoever keeps the shop.
     */
    name: string | undefined;

    /**
     * Money units the vendor starts with, and all it can pay out. Omit it for a purse that never runs out.
     */
    purse: number | undefined;

    /**
     * Whether the vendor takes the player's items at all. On by default; `setBuyPrices` says which ones.
     */
    buys: boolean | undefined;
  }

  /**
   * One thing a vendor sells.
   */
  interface VendorStockRow {
    /**
     * The item class, by GUID or by the game's own item name.
     */
    item: string;

    /**
     * How many the vendor has. A row the players buy out disappears.
     */
    amount: number;

    /**
     * What one costs, in money units -- the amount of the game's `money` item, which is also what `player.giveItem('money', n)` hands out.
     */
    price: number;
  }

  /**
   * One thing a vendor buys from players.
   */
  interface VendorBuyRow {
    /**
     * The item class, by GUID or by the game's own item name.
     */
    item: string;

    /**
     * What the vendor pays for one, in money units.
     */
    price: number;
  }

  /**
   * One settled line of a deal.
   */
  interface VendorTradeLine {
    /**
     * The item class GUID.
     */
    item: string;

    /**
     * The game's own name for the item class.
     */
    name: string;

    /**
     * How many changed hands.
     */
    amount: number;

    /**
     * What one was priced at when the deal settled.
     */
    price: number;
  }

  /**
   * Price lists and purses the server owns, traded on the game's own shop screen.
   * 
   * A vendor is attached to nothing: open one in front of a player from wherever the gamemode decides the counter is -- `npcInteract`, a dialogue option, a command. The screen is a preview. Its prices come from here, and pressing Trade sends a basket that the server re-prices, settles and moves itself; nothing the client shows is trusted.
   * 
   * Prices count in money units, the amount of the game's `money` item.
   */
  const Vendor: {
    /**
     * Creates a vendor with nothing to sell and nothing it buys.
     * @param options Name, starting purse and whether it buys. All optional.
     * @returns The vendor id.
     */
    create(options?: VendorOptions): number;

    /**
     * Closes every session at the vendor and forgets it. A deal already settling still completes.
     * @param vendor The vendor to remove.
     * @returns False when there was no such vendor.
     */
    destroy(vendor: number): boolean;

    /**
     * Replaces what a vendor sells. Every player with its screen open sees the new shelf straight away, and a basket priced against the old one is refused.
     * @param vendor The vendor to stock.
     * @param rows Everything it sells, at most 128 rows and each item class once. Replaces the old list.
     * @returns False when there is no such vendor.
     */
    setStock(vendor: number, rows: VendorStockRow[]): boolean;

    /**
     * Replaces what a vendor buys from players and what it pays. Anything not listed is shown at no value and a basket selling it is refused.
     * @param vendor The vendor to change.
     * @param rows Everything it buys, at most 128 rows and each item class once. Replaces the old list.
     * @returns False when there is no such vendor.
     */
    setBuyPrices(vendor: number, rows: VendorBuyRow[]): boolean;

    /**
     * Sets what a vendor can pay out. Deals keep it current: what players pay goes in, what they are paid comes out.
     * @param vendor The vendor to change.
     * @param purse Money units it holds, or null for a purse that never runs out.
     * @returns False when there is no such vendor.
     */
    setPurse(vendor: number, purse: number | null): boolean;

    /**
     * What a vendor holds.
     * @param vendor The vendor to ask about.
     * @returns Money units, or null for a purse that never runs out or a vendor that does not exist.
     */
    getPurse(vendor: number): number | null;

    /**
     * Opens the game's own trade screen on a player. A player already trading has that session closed with reason 2 first, because the game has one trade screen.
     * @param vendor The vendor to trade with.
     * @param player NetworkID of the player to show it to.
     * @param npc NetworkID of the NPC who keeps the shop. The screen shows that NPC as the trader; omit it to trade with nobody in particular.
     * @returns The session id, or 0 when the vendor or the player is gone.
     */
    open(vendor: number, player: number, npc?: number): number;

    /**
     * Takes the trade screen off that player.
     * @param session The session to end.
     * @returns False when the session had already ended.
     */
    close(session: number): boolean;

    /**
     * The trading session a player is in.
     * @param player NetworkID of the player to ask about.
     * @returns The session id, or 0 when they are not trading.
     */
    sessionOf(player: number): number;

    /**
     * The vendor a session trades with.
     * @param session The session to ask about.
     * @returns The vendor id, or 0 when the session has ended.
     */
    vendorOf(session: number): number;
  };

  /**
   * Replicated KCD2 dog companion handle.
   */
  class Dog {
    /**
     * Creates a script wrapper for an existing dog with this ID; use Dog.spawn() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * GUID of the soul this dog was spawned against, which decides its appearance.
     */
    readonly soul: string;

    /**
     * Name every client shows for this dog. Assignment renames it on all of them; empty means the name its soul carries stands.
     */
    name: string;

    /**
     * Network ID of the player this dog belongs to, or 0 when it has no master.
     */
    readonly ownerId: number;

    /**
     * The player this dog belongs to, or null when it has no master.
     */
    readonly owner: Player | null;

    /**
     * The dog's companion mode: 0 Wait, 1 Follow, 2 Free, 3 Aggressive, 4 Search, 5 Hunt, 6 Guard, 7 Ambush. Assignment applies it on every client.
     */
    mode: number;

    /**
     * What the owner's game currently has this dog doing, as an E_DogObjective ordinal: 0 Wait, 2 Bark, 4 Follow, 5 FollowHeel, 7 Search, 8 MeleeCombat, 9 Fetch, 10 Hunt, 19 Eat, 21 Distract, 22 Pet, 25 Invalid when idle. Reported by the owner, so read-only.
     */
    readonly objective: number;

    /**
     * The dog's morale as its owner last read it off the game, or 0 before any report. Below the game's own threshold the dog stops obeying commands. Owner-reported, so read-only.
     */
    readonly morale: number;

    /**
     * Formats this dog handle for logging and debugging.
     * @returns The dog ID, its soul, its owner and its mode.
     */
    toString(): string;

    /**
     * Despawns this dog on every client after emitting dogDestroy.
     */
    destroy(): void;

    /**
     * Hands this dog to another player. Every client re-possesses the body onto the new master's soul, and authority over its pose moves with it.
     * @param player The dog's new master, or null to leave it masterless.
     */
    giveTo(player: Player | null): void;

    /**
     * Spawns and replicates a dog companion for a player.
     * @param owner The player the dog belongs to. A dog is somebody's from the moment it exists.
     * @param position Optional world-space spawn position; omitted spawns the dog on its owner.
     * @param rotation Optional initial orientation: a Quaternion, or a Vector3 of Euler angles in degrees.
     * @param soul Optional soul GUID from the game's tables; omitted spawns the generic dog.
     * @param name Optional name every client shows for the dog; omitted leaves the name its soul carries.
     * @returns The newly spawned dog handle.
     */
    static spawn(owner: Player, position?: Vector3 | Partial<Vector3>, rotation?: Vector3 | Quaternion, soul?: string, name?: string): Dog;

    /**
     * Lists every dog the server currently has.
     * @returns One handle per live dog, in no particular order.
     */
    static all(): Dog[];

    /**
     * Looks a dog up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The dog's handle, or null when no live dog has that ID.
     */
    static getById(id: number): Dog | null;
  }

  interface Dog extends Entity {}

  /**
   * Replicated static mesh handle.
   */
  class Prop {
    /**
     * Creates a script wrapper for an existing prop with this ID; use Prop.spawn() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Catalog path of the mesh this prop was built from, e.g. `objects/manmade/barrels/barrel_a.cgf`. Read-only: the collision is built from the mesh when the entity is spawned and never re-read, so a prop is the model it was created with.
     */
    readonly model: string;

    /**
     * File stem of the mesh, e.g. `barrel_a`, which is the short name `Prop.spawn` also accepts.
     */
    readonly modelName: string;

    /**
     * Browsing bucket the mesh sits in, e.g. `manmade/structures`.
     */
    readonly modelGroup: string;

    /**
     * What this prop's collision does: `static` collides but never moves, `rigid` falls and can be pushed, `none` has none at all. Assignment rebuilds the prop on every client, and a rigid one is simulated separately by each of them with nothing reconciling it.
     */
    physics: string;

    /**
     * Uniform scale, from 0.01 to 100; a value outside that is clamped into it. Assignment rebuilds the prop on every client, because the collision is sized from the scale at spawn and never re-read.
     */
    scale: number;

    /**
     * Formats this prop handle for logging and debugging.
     * @returns The prop ID, its model, its physics and its scale.
     */
    toString(): string;

    /**
     * Despawns this prop on every client after emitting propDestroy.
     */
    destroy(): void;

    /**
     * Spawns and replicates a static mesh from the game's own object catalog.
     * @param model Mesh to build, as either a full catalog path (`objects/manmade/barrels/barrel_a.cgf`) or its file stem (`barrel_a`). A stem several meshes share resolves to the first of them, so pass the path when it matters which.
     * @param position Optional world-space spawn position; omitted components default to zero.
     * @param rotation Optional initial orientation: a Quaternion, or a Vector3 of Euler angles in degrees.
     * @param scale Optional uniform scale from 0.01 to 100; omitted spawns the mesh at its own size.
     * @param physics Optional collision: `static` (the default), `rigid` or `none`.
     * @param virtualWorld Optional virtual world the prop belongs to; omitted puts it in the global one.
     * @returns The newly spawned prop handle.
     */
    static spawn(model: string, position?: Vector3 | Partial<Vector3>, rotation?: Vector3 | Quaternion, scale?: number, physics?: string, virtualWorld?: number): Prop;

    /**
     * Lists every prop the server currently has.
     * @returns One handle per live prop, in no particular order.
     */
    static all(): Prop[];

    /**
     * Looks a prop up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The prop's handle, or null when no live prop has that ID.
     */
    static getById(id: number): Prop | null;

    /**
     * Despawns props, emitting propDestroy for each one.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many props were removed.
     */
    static destroyAll(virtualWorld?: number): number;
  }

  interface Prop extends Entity {}

  /**
   * Replicated particle effect handle.
   */
  class Vfx {
    /**
     * Creates a script wrapper for an existing effect with this ID; use Vfx.spawn() to place one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Name of the particle effect this is playing, e.g. `WH_Particels.fires.campfire_a`. Read-only: every spawn parameter is read once when the emitter is created, so an effect is the one it was placed as.
     */
    readonly effect: string;

    /**
     * Particle library the effect came out of, e.g. `WH_Particels`, which is the part of the name before the first dot.
     */
    readonly library: string;

    /**
     * Authored bucket inside that library, e.g. `fires`.
     */
    readonly group: string;

    /**
     * Multiplies every size the effect authored, from 0.01 to 32; a value outside that is clamped into it. Assignment rebuilds the emitter on every client that can see it, so the effect restarts.
     */
    scale: number;

    /**
     * Multiplies how many particles are emitted, from 0.01 to 16. Assignment restarts the effect.
     */
    countScale: number;

    /**
     * Multiplies emission speed, from 0 to 16. Assignment restarts the effect.
     */
    speedScale: number;

    /**
     * Multiplies how fast the emitter's own time runs, from 0.01 to 16. Assignment restarts the effect.
     */
    timeScale: number;

    /**
     * Feeds the effect's own strength curves, from -1 to 1; -1 leaves them where the effect authored them. Assignment restarts the effect.
     */
    strength: number;

    /**
     * Seconds between restarts of the whole emitter, from 0 to 600; 0 never restarts it. Assignment restarts the effect.
     */
    pulsePeriod: number;

    /**
     * Formats this effect handle for logging and debugging.
     * @returns The effect ID, its name and its scale.
     */
    toString(): string;

    /**
     * Stops this effect on every client that can see it, after emitting vfxDestroy.
     */
    destroy(): void;

    /**
     * Places a particle effect in the world and leaves it running. It is a replicated entity, so the interest grid streams it to whoever comes near and takes it away again when they leave -- which is what a campfire, a torch or a plume of smoke needs and what `burst` cannot do. How far it streams is taken from the effect's own draw distance, between 25 and 250 metres.
     * @param effect Effect to place, spelled as the game's particle libraries spell it -- `WH_Particels.fires.campfire_a`. `Vfx.list()` is the whole vocabulary.
     * @param position Optional world-space position; omitted components default to zero.
     * @param options `rotation` aims the emitter; `scale`, `countScale`, `speedScale` and `timeScale` multiply what the effect authored; `strength` feeds its strength curves; `pulsePeriod` restarts it on that many seconds; `prime` starts it already running, which is what a fire wants. `durationMs` is ignored here -- a placed effect lasts until it is destroyed.
     * @param virtualWorld Optional virtual world the effect belongs to; omitted puts it in the global one.
     * @returns The newly placed effect handle.
     */
    static spawn(effect: string, position?: Vector3 | Partial<Vector3>, options?: { rotation?: Quaternion | Vector3; scale?: number; countScale?: number; speedScale?: number; timeScale?: number; strength?: number; pulsePeriod?: number; prime?: boolean; durationMs?: number }, virtualWorld?: number): Vfx;

    /**
     * Plays an effect once for the players who can see the point it happens at, and keeps nothing. Recipients are chosen by the effect's own draw distance -- there is no point telling a client about something its engine would not draw -- so a blood spray reaches the people standing there and nobody else. A player who arrives afterwards sees nothing, which is the right answer for a spark and the wrong one for a campfire; use `spawn` for those.
     * @param effect Effect to play, spelled as the game's particle libraries spell it.
     * @param position Where it happens, in world-space metres.
     * @param options As `spawn`, and here `durationMs` does apply: how long each client keeps the emitter, two seconds by default and a minute at most.
     * @param virtualWorld Optional virtual world; omitted uses the global one.
     * @returns How many clients were told.
     */
    static burst(effect: string, position: Vector3, options?: { rotation?: Quaternion | Vector3; scale?: number; countScale?: number; speedScale?: number; timeScale?: number; strength?: number; pulsePeriod?: number; prime?: boolean; durationMs?: number }, virtualWorld?: number): number;

    /**
     * Plays an effect once on a replicated entity, where it follows that entity: blood on the body that was hit, sparks on the weapon that struck. A client that has not streamed the entity in drops it rather than playing it somewhere else.
     * @param effect Effect to play, spelled as the game's particle libraries spell it.
     * @param entity What to hang it on: any replicated handle -- a Player, Prop, Horse or Dog -- or a bare network entity ID.
     * @param options As `burst`, plus `offset`: where the emitter sits in the entity's own space, in metres, up to 8 m from its origin.
     * @returns How many clients were told.
     */
    static burstOn(effect: string, entity: Entity | number, options?: { offset?: Vector3; rotation?: Quaternion | Vector3; scale?: number; countScale?: number; speedScale?: number; timeScale?: number; strength?: number; pulsePeriod?: number; prime?: boolean; durationMs?: number }): number;

    /**
     * Lists every replicated effect the server currently has.
     * @param virtualWorld Optional virtual world to list; omitted lists every one of them.
     * @returns One handle per live effect, in no particular order.
     */
    static all(virtualWorld?: number): Vfx[];

    /**
     * Looks a replicated effect up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The effect's handle, or null when no live effect has that ID.
     */
    static getById(id: number): Vfx | null;

    /**
     * Stops replicated effects, emitting vfxDestroy for each one.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many effects were stopped.
     */
    static destroyAll(virtualWorld?: number): number;

    /**
     * Every effect name the shipped game declares, in order. Mined from the game's particle libraries at build time, so it is the same list the client has.
     * @param prefix Keep only the names starting with this, e.g. `WH_Particels.fires` or `collisions.combat`.
     * @returns The matching names.
     */
    static list(prefix?: string): string[];
  }

  interface Vfx extends Entity {}

  /**
   * Replicated ground marker handle.
   */
  class Marker {
    /**
     * Creates a script wrapper for an existing marker with this ID; use Marker.place() to draw one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Decal material this marker is drawn with, e.g. `materials/decals/chalk_cross`. Read-only: a decal node reads its material once, so a marker is the one it was placed as.
     */
    readonly material: string;

    /**
     * Subfolder the material came out of under `materials/decals/`, empty at the top level.
     */
    readonly group: string;

    /**
     * What the marker is made of: `decal` for the projected one, or `cylinder`, `sphere`, `chevron`, `cube` or `plane` for a mesh standing in the world. Read-only: changing it is a rebuild, so place a new marker instead.
     */
    readonly shape: string;

    /**
     * How wide the marker is, in metres, from 0.25 to 64; a value outside that is clamped into it. Assignment restates it in place rather than rebuilding, and widens how far the marker streams.
     */
    size: number;

    /**
     * How tall a mesh marker stands, in metres, from 0.25 to 64. Ignored by `decal`, `sphere` and `plane`, which are sized by width alone.
     */
    height: number;

    /**
     * Degrees per second the marker turns about its own up axis, from -720 to 720; 0 stands still. Played on each client's own clock, so two players need not see it at the same angle. Ignored by `decal`.
     */
    spin: number;

    /**
     * Packed 0xRRGGBBAA tint, or 0 for the material as it ships. The shipped material is shared by everything that names it, so a tint is a private clone rather than a write to the original -- which is why assignment rebuilds the marker.
     */
    color: number;

    /**
     * Whether clients watch the local player against this marker's volume and report crossings, which is what raises `markerEnter` and `markerExit`. Off by default: a marker nobody listens to should cost nothing but its draw.
     */
    trigger: boolean;

    /**
     * How far the marker rises and falls from its resting height, in metres, up to 4; 0 stands still. Played on each client's own clock. Ignored by `decal`, which cannot leave the surface it projects onto.
     */
    bob: number;

    /**
     * Formats this marker handle for logging and debugging.
     * @returns The marker ID, its material and its size.
     */
    toString(): string;

    /**
     * Removes this marker from every client that can see it, after emitting markerRemove.
     */
    remove(): void;

    /**
     * Puts a marker in the world and leaves it there. It is a replicated entity, so the interest grid streams it to whoever comes near and takes it away again when they leave -- which is what a zone or a checkpoint needs and what a one-shot message cannot do. How far it streams is taken from its own extent, between 50 and 400 metres.
     * @param material Decal material to project, spelled as the game's own data spells it -- `materials/decals/chalk_cross`. `Marker.list()` is the whole vocabulary.
     * @param position Optional world-space position; omitted components default to zero.
     * @param options `shape` picks what it is made of -- `decal` projects onto the surface under it, the rest stand in the world as meshes and can be seen from below a ridge. `rotation` aims it, so a marker laid on a wall is the same call with a different rotation; `size` and `height` are its extent in metres; `spin` and `bob` give a mesh marker motion; `color` tints it.
     * @param virtualWorld Optional virtual world the marker belongs to; omitted puts it in the global one.
     * @returns The newly drawn marker handle.
     */
    static place(material: string, position?: Vector3 | Partial<Vector3>, options?: { shape?: 'decal' | 'cylinder' | 'sphere' | 'chevron' | 'cube' | 'plane'; rotation?: Quaternion | Vector3; size?: number; height?: number; spin?: number; bob?: number; color?: number; trigger?: boolean }, virtualWorld?: number): Marker;

    /**
     * Lists every replicated marker the server currently has.
     * @param virtualWorld Optional virtual world to list; omitted lists every one of them.
     * @returns One handle per live marker, in no particular order.
     */
    static all(virtualWorld?: number): Marker[];

    /**
     * Looks a replicated marker up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The marker's handle, or null when no live marker has that ID.
     */
    static getById(id: number): Marker | null;

    /**
     * Removes markers, emitting markerRemove for each one.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many markers were removed.
     */
    static removeAll(virtualWorld?: number): number;

    /**
     * Every decal material the shipped game preloads, in order. Mined from the game's own material folder at build time, so it is the same list the client has.
     * @param prefix Keep only the names starting with this, e.g. `materials/decals/burglar`.
     * @returns The matching names.
     */
    static list(prefix?: string): string[];
  }

  interface Marker extends Entity {}

  /**
   * Replicated compass and map-screen blip handle.
   */
  class Blip {
    /**
     * Creates a script wrapper for an existing blip with this ID; use Blip.create() to place one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Which of the game's own compass icons the blip draws as, by the game's own name for it -- `Blip.types()` lists them. Assigning a name the game does not know leaves the blip as it was.
     */
    type: string;

    /**
     * The mark's state, forwarded to the compass and map movies as-is -- what the client Blip calls `state`, renamed here because every entity's `state` is its StateBag. What a given value draws is undocumented; 0 is what a fresh game mark carries.
     */
    markState: number;

    /**
     * The blip's name on the map screen, shown verbatim in place of the name the game gives its icon type; empty keeps that name. Cut to 64 bytes. The compass has no text, so it never shows this.
     */
    label: string;

    /**
     * Whether the blip is drawn on players' HUD compasses.
     */
    compass: boolean;

    /**
     * Whether the blip is drawn on players' map screens, for an icon the map has art for: `Main`, `Side`, `Micro`, `Checkpoint`, `Dlcs`, `Bailiff`, `FistFight` and `Racing` have none and stay on the compass. The map legend's switch for the blip's icon type hides it like one of the game's own.
     */
    map: boolean;

    /**
     * Formats this blip handle for logging and debugging.
     * @returns The blip ID, its type and its label.
     */
    toString(): string;

    /**
     * Takes this blip off every compass and map screen that shows it.
     */
    remove(): void;

    /**
     * Puts a blip on the compass and map screen of every player in its virtual world, or of the one player it is private to. It is a replicated entity that is never culled by distance -- a blip is for finding something far away -- so it reaches players however far they are and whenever they join, and assigning `position` moves it for all of them. `setVisibleTo` works on it like on any entity.
     * @param options Where the blip goes, which icon it draws with -- one of `Blip.types()`, `GeneralPoi` by default -- its mark state, its name on the map screen, and whether it shows on the compass and the map screen, both by default. `player` makes it private to that player from the start; `virtualWorld` puts a public one in that world, the global one by default.
     * @returns The new blip handle.
     */
    static create(options: { position: Vector3; type?: string; markState?: number; label?: string; compass?: boolean; map?: boolean; player?: Player; virtualWorld?: number }): Blip;

    /**
     * Lists every blip the server currently has.
     * @param virtualWorld Optional virtual world to list; omitted lists every one of them.
     * @returns One handle per live blip, in no particular order.
     */
    static all(virtualWorld?: number): Blip[];

    /**
     * Looks a blip up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The blip's handle, or null when no live blip has that ID.
     */
    static getById(id: number): Blip | null;

    /**
     * Removes blips.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many blips were removed.
     */
    static removeAll(virtualWorld?: number): number;

    /**
     * Every icon a blip can draw with, by the game's own name for it, misspellings included.
     * @returns The names, in the game's own order.
     */
    static types(): string[];
  }

  interface Blip extends Entity {}

  /**
   * A server-owned NPC: spawned by a resource, simulated by whichever client is nearest.
   */
  class Npc {
    /**
     * Creates a script wrapper for an existing NPC with this ID; use Npc.create() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * GUID of the soul the body was spawned against, or empty for an adopted level body. Read-only: a soul decides what the body is, so a different one is a different NPC.
     */
    readonly soul: string;

    /**
     * Entity class the body is spawned as -- `NPC` or `NPC_Female`.
     */
    readonly actorClass: string;

    /**
     * `EntityGuid` of the level body this NPC adopted, or 0 for a spawned one.
     */
    readonly levelGuid: number;

    /**
     * What every client shows over the body and in conversation. Empty leaves the name its soul was born with.
     */
    name: string;

    /**
     * Faction row used for relationship and crime decisions; 0 is no faction.
     */
    faction: number;

    /**
     * The server's ledger of this body's health, clamped to `maxHealth`. Damage from players arrives here after the server has agreed to it.
     */
    health: number;

    /**
     * Health the body starts with and is revived to.
     */
    readonly maxHealth: number;

    /**
     * False once health reached zero. A dead NPC is still an entity -- it is a corpse, and it can still be looted or revived.
     */
    readonly alive: boolean;

    /**
     * Whether damage is refused before it reaches the ledger.
     */
    invulnerable: boolean;

    /**
     * Whether the body holds its pose whatever its intent says.
     */
    frozen: boolean;

    /**
     * Whether clients watch the use key against this body and raise `npcInteract`. On by default.
     */
    interactable: boolean;

    /**
     * Whether its name is drawn over it the way a player's is.
     */
    nametag: boolean;

    /**
     * Whether its corpse keeps its inventory for whoever searches it.
     */
    lootable: boolean;

    /**
     * How the simulating client moves this body.
     * 
     * `kinematic` (the default) advances the pose and lets every client animate it -- predictable, and the same path every remote player's body already runs on. `native` hands the destination to the game's own movement controller, which walks the body with real footfalls and real turns but will walk into whatever the engine does not route around. Pick `native` for bodies in the open and `kinematic` for anything on an authored route.
     */
    locomotion: string;

    /**
     * What the NPC has been told to do: `hold`, `moveTo`, `follow`, `flee`, `lookAt`, `playAnim` or `talk`.
     */
    readonly intent: string;

    /**
     * What the simulating client last reported about the current intent: `idle`, `running`, `reached`, `blocked` or `failed`. A dormant NPC that is walking an authored route reports through the server's own dead reckoning instead, so a patrol keeps stepping with nobody there to watch it.
     */
    readonly status: string;

    /**
     * The body under the clothes, as the game's own component names. Write it with `setAppearance`.
     */
    readonly appearance: Appearance;

    /**
     * The player whose client is currently running this NPC, or null while it is dormant. Dormant is not broken: nobody is near enough for it to matter, and the server keeps its route advancing until somebody is.
     */
    readonly simulator: Player | null;

    /**
     * Formats this NPC handle for logging and debugging.
     * @returns The NPC's ID, name, intent and last reported status.
     */
    toString(): string;

    /**
     * Despawns this NPC everywhere, after emitting npcDestroy.
     */
    remove(): void;

    /**
     * Cancels whatever it was doing and leaves it standing where it is.
     */
    hold(): void;

    /**
     * Sends the NPC somewhere and raises `npcIntentDone` when it arrives, cannot get there, or gives up. Cancels any patrol.
     * @param position Where to walk to.
     * @param options `speed` is the pace to walk at; `radius` is how close counts as arrived, in metres.
     * @returns True when the order went out.
     */
    moveTo(position: Vector3 | Partial<Vector3>, options?: { speed?: 'walk' | 'jog' | 'run'; radius?: number }): boolean;

    /**
     * Walks a route, one waypoint at a time. The route stays on the server and only the waypoint being walked to is ever replicated, so a player who joins mid-patrol sees one move rather than a plan to catch up with -- and a patrol nobody is near enough to simulate keeps advancing on the server's own reckoning.
     * @param points The waypoints, in order.
     * @param options `loop` walks the route forever (the default); `waitSeconds` is how long to stand at each waypoint; `speed` is the pace.
     * @returns True when the route was accepted; false for an empty route or a point that is not finite.
     */
    patrol(points: (Vector3 | Partial<Vector3>)[], options?: { speed?: 'walk' | 'jog' | 'run'; loop?: boolean; waitSeconds?: number }): boolean;

    /**
     * Keeps the NPC near somebody as they move.
     * @param target Who to follow, as a handle or a network ID.
     * @param options `radius` is how close it tries to stay, in metres; `speed` is the pace.
     * @returns True when the order went out.
     */
    follow(target: Player | Npc | number, options?: { speed?: 'walk' | 'jog' | 'run'; radius?: number }): boolean;

    /**
     * Sends the NPC away from a place. The one intent that picks its own direction.
     * @param from What to run away from.
     * @param options `radius` is how far away is far enough; `speed` is the pace, `run` by default.
     * @returns True when the order went out.
     */
    flee(from: Vector3 | Partial<Vector3>, options?: { speed?: 'walk' | 'jog' | 'run'; radius?: number }): boolean;

    /**
     * Turns the NPC's head, and its body when it has to, without moving it.
     * @param target Who or what to look at.
     * @returns True when the order went out.
     */
    lookAt(target: Player | Npc | number | Vector3 | Partial<Vector3>): boolean;

    /**
     * Moves the body outright, whoever is simulating it. Unlike a player teleport this is a write rather than a request: the server bumps the body's epoch, so a pose the simulator had already sent cannot put it back.
     * @param position Where to put it.
     * @param rotation Optional facing; a Quaternion, or Euler angles in degrees.
     * @returns True when the position was usable.
     */
    teleport(position: Vector3 | Partial<Vector3>, rotation?: Quaternion | Vector3 | Partial<Vector3>): boolean;

    /**
     * Plays a one-shot gesture on every client that can see the body. Fire-and-forget: a client that joins afterwards does not replay it.
     * @param id Row of the shipped emote catalog.
     * @returns True when the gesture went out.
     */
    playAnimation(id: number): boolean;

    /**
     * Puts a line of speech over the body on every client that can see it.
     * @param text What it says, up to 256 characters.
     * @returns True when the line went out.
     */
    say(text: string): boolean;

    /**
     * Dresses the body in exactly these items, replacing what it had on.
     * @param itemClasses Item class GUIDs, as the game's own tables spell them.
     * @returns True when every GUID parsed.
     */
    wear(itemClasses: string[]): boolean;

    /**
     * Dresses the body in one of the game's own outfits.
     * @param preset Clothing preset GUID from the game's own table.
     * @returns True when the preset is one this build has.
     */
    setOutfit(preset: string): boolean;

    /**
     * Changes the body under the clothes -- face, hair, beard and skin. Unlike a player's, this is a write rather than a request: nobody owns an NPC's body but the server.
     * @param appearance The parts to change; anything left out keeps what it is wearing.
     * @returns True when the appearance was accepted.
     */
    setAppearance(appearance: Partial<Appearance>): boolean;

    /**
     * Takes health off the ledger, raising `npcDamage` and, if it is the last of it, `npcDeath`. Refused for an invulnerable or already-dead body.
     * @param amount Health to take off.
     * @param attacker Who did it, for the events this raises.
     */
    damage(amount: number, attacker?: Player | number): void;

    /**
     * Kills it outright, through the same path damage takes -- including an invulnerable one, which is the difference between this and `damage`.
     * @param attacker Who to credit with it.
     */
    kill(attacker?: Player | number): void;

    /**
     * Brings a dead NPC back at full health. Every client makes a fresh body for it, because the one they have is a corpse.
     */
    revive(): void;

    /**
     * Pins simulation of this NPC to one player's client, whatever the distances say. What a scripted scene wants: the actor has to be run by the machine the scene is being played to. A pinned NPC goes dormant rather than migrating when that player leaves range, and is unpinned automatically if they disconnect.
     * @param player Whose client should run it, or null to hand it back to the election.
     */
    pin(player: Player | number | null): void;

    /**
     * Spawns an NPC and replicates it. It exists on the server from this moment: every client near enough makes a body for it, one of them is elected to run it, and the rest draw what that one reports.
     * 
     * The body is not simulated until somebody is close enough to run it, which is not a failure -- a guard on the other side of the map has nothing to do that anybody can see. Read `simulator` to tell.
     * @param options `soul` is a role name from `Npc.roles()` or a soul GUID; `position` is where to put it. Everything else has a default.
     * @returns The new NPC's handle.
     */
    static create(options: { soul?: string; class?: string; name?: string; outfit?: string; wearing?: string[]; appearance?: Partial<Appearance>; position?: Vector3 | Partial<Vector3>; rotation?: Quaternion | Vector3 | Partial<Vector3>; faction?: number; health?: number; maxHealth?: number; locomotion?: 'kinematic' | 'native'; invulnerable?: boolean; frozen?: boolean; interactable?: boolean; nametag?: boolean; lootable?: boolean; virtualWorld?: number }): Npc;

    /**
     * Takes over one of the level's own NPCs instead of spawning a new body. A level `EntityGuid` is the same number on every machine, so every client finds the same body -- which is how doors, gates and stashes are already addressed. Adopting the same guid twice returns the NPC that already has it.
     * @param levelGuid `EntityGuid` of the body the level already placed.
     * @param options The same options a spawn takes; `soul` and `class` are ignored, since the body already exists.
     * @returns The NPC handle for that body.
     */
    static adopt(levelGuid: number, options?: { soul?: string; class?: string; name?: string; outfit?: string; wearing?: string[]; appearance?: Partial<Appearance>; position?: Vector3 | Partial<Vector3>; rotation?: Quaternion | Vector3 | Partial<Vector3>; faction?: number; health?: number; maxHealth?: number; locomotion?: 'kinematic' | 'native'; invulnerable?: boolean; frozen?: boolean; interactable?: boolean; nametag?: boolean; lootable?: boolean; virtualWorld?: number }): Npc;

    /**
     * Lists every server-owned NPC.
     * @param virtualWorld Optional virtual world to list; omitted lists every one of them.
     * @returns One handle per live NPC, in no particular order.
     */
    static all(virtualWorld?: number): Npc[];

    /**
     * Looks an NPC up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The NPC's handle, or null when no live NPC has that ID.
     */
    static getById(id: number): Npc | null;

    /**
     * Despawns NPCs, emitting npcDestroy for each.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many were despawned.
     */
    static removeAll(virtualWorld?: number): number;

    /**
     * The named kinds of NPC this build ships -- `guard`, `bandit`, `townswoman` and the rest. Each is a real soul out of the game's own tables, so a role spawns a body that already looks the part. Anything not in this list is taken as a soul GUID.
     * @returns The role names.
     */
    static roles(): string[];
  }

  interface Npc extends Entity {}

  /**
   * Replicated journal quest handle.
   */
  class Quest {
    /**
     * Creates a script wrapper for an existing quest with this ID; use Quest.give() to write one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The key the quest is filed under, and the name the game knows the quest node by. Read-only: it is the quest's identity.
     */
    readonly key: string;

    /**
     * The line the journal row and the quest toast show. Assignment is silent; it does not raise a toast.
     */
    title: string;

    /**
     * The body of the journal's diary page for this quest. Assignment is silent.
     */
    description: string;

    /**
     * Which section of the journal the quest files under. Read-only: it is decided when the quest is given.
     */
    readonly type: string;

    /**
     * `active`, `done` or `failed`. Assignment announces the change; `setProgress` can do it quietly.
     */
    progress: string;

    /**
     * Network id of the one player this quest was written for, or 0 when it went to everyone in the world. Read-only: who a quest belongs to is decided when it is given.
     */
    readonly player: number;

    /**
     * How many objectives the quest carries, up to eight.
     */
    readonly objectiveCount: number;

    /**
     * Formats this quest handle for logging and debugging.
     * @returns The quest ID, its key, its state and how many objectives it carries.
     */
    toString(): string;

    /**
     * Takes this quest out of every journal it was written into.
     */
    remove(): void;

    /**
     * Moves the quest on. There is no way back to unstarted: a quest nobody should see any more is removed.
     * @param progress Where the quest now stands.
     * @param announce Whether to raise the game's quest-updated toast; defaults to true. Pass false for a correction the player should not be told about.
     */
    setProgress(progress: 'active' | 'done' | 'failed', announce?: boolean): void;

    /**
     * Rewrites one line of the quest in place.
     * @param index Which objective to rewrite, counting from zero. An index past the end is ignored.
     * @param objective The line, as text or as an object carrying its state.
     * @param announce Whether to raise the quest-updated toast; defaults to true.
     */
    setObjective(index: number, objective: string | { text: string; progress?: 'active' | 'done' | 'failed'; optional?: boolean }, announce?: boolean): void;

    /**
     * Replaces the quest's objective list.
     * @param objectives The whole list, at most eight entries; anything past that is dropped.
     * @param announce Whether to raise the quest-updated toast; defaults to true.
     */
    setObjectives(objectives: (string | { text: string; progress?: 'active' | 'done' | 'failed'; optional?: boolean })[], announce?: boolean): void;

    /**
     * Reads the quest's objectives back.
     * @returns One entry per objective, in journal order.
     */
    objectives(): { text: string; progress: 'active' | 'done' | 'failed' | 'none'; optional: boolean }[];

    /**
     * Writes a quest into the game's own journal. It is a replicated entity, so a player who joins late, reloads or walks away still finds it in their log -- which is what a quest needs and what a one-shot notification cannot do. What the player sees is the game's quest UI: its journal row, its diary page, its objective tracker and its quest-updated toast, all reading a quest node the client builds with the game's own constructor.
     * @param key What the quest is filed under: up to 64 letters, digits, underscores or dashes, unique within its virtual world.
     * @param title The line the journal row shows.
     * @param options `description` is the diary page, `type` the journal section, `objectives` the lines under it, `player` the network id of the one player it belongs to, and `announce` whether to raise the toast.
     * @param virtualWorld Optional virtual world the quest belongs to; omitted puts it in the global one.
     * @returns The newly written quest handle.
     */
    static give(key: string, title: string, options?: { description?: string; type?: 'main' | 'side' | 'activity' | 'event' | 'micro' | 'racing'; objectives?: (string | { text: string; progress?: 'active' | 'done' | 'failed'; optional?: boolean })[]; player?: number; announce?: boolean }, virtualWorld?: number): Quest;

    /**
     * Lists every replicated quest the server currently has.
     * @param virtualWorld Optional virtual world to list; omitted lists every one of them.
     * @returns One handle per live quest, in no particular order.
     */
    static all(virtualWorld?: number): Quest[];

    /**
     * Looks a quest up by its key.
     * @param key The key the quest was given under.
     * @param virtualWorld Optional virtual world to search; omitted searches every one of them.
     * @param player Network id of the player whose copy to find. Keys are unique per recipient, so this is how one player's errand is told from another's.
     * @returns The quest's handle, or null when no live quest has that key.
     */
    static find(key: string, virtualWorld?: number, player?: number): Quest | null;

    /**
     * Looks a replicated quest up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The quest's handle, or null when no live quest has that ID.
     */
    static getById(id: number): Quest | null;

    /**
     * Takes quests out of every journal they were written into.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many quests were removed.
     */
    static removeAll(virtualWorld?: number): number;
  }

  interface Quest extends Entity {}

  /**
   * Replicated world stack handle.
   */
  class GroundItem {
    /**
     * Creates a script wrapper for an existing ground item with this ID; use GroundItem.spawn() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The class of item lying here, as the same 32 hex digits `player.rightHandItem` and `player.equipment` use, so the three can be compared directly. The server holds no name for a class: naming one is an item database's job.
     */
    readonly itemClass: string;

    /**
     * How many units are in the stack. One entity however many that is: a stack is picked up whole or not at all.
     */
    readonly amount: number;

    /**
     * Quality the stack was made with, or 0 when it was left to the class's own.
     */
    readonly quality: number;

    /**
     * Absolute item health from 0 to 1, or -1 when it was left to the class's own.
     */
    readonly health: number;

    /**
     * Displayed condition from 0 to 1, or -1 when it was left to the class's own.
     */
    readonly condition: number;

    /**
     * Whether the stack has settled where it will stay. A stack a script spawned is resting from the start; one a player threw down is false until that player's own physics stops it and publishes the final pose, and its position moves until then.
     */
    readonly resting: boolean;

    /**
     * Network ID of the player who dropped this stack, or 0 when the server spawned it.
     */
    readonly droppedById: number;

    /**
     * The player who dropped this stack, or null when the server spawned it or that player has since left.
     */
    readonly droppedBy: Player | null;

    /**
     * Formats this ground item handle for logging and debugging.
     * @returns The stack ID, its item class, how many of it there are and whether it has settled.
     */
    toString(): string;

    /**
     * Takes this stack back out of the world on every client after emitting groundItemDestroy.
     */
    destroy(): void;

    /**
     * Lays a pickable stack of an item on the ground and replicates it, spawning it already at rest.
     * @param item Item class to lay down, as either its GUID or its name (`arrow_crude`). The same spelling `player.giveItem` takes.
     * @param position Optional world-space spawn position; omitted components default to zero. The stack is placed there rather than dropped, so put it where the ground is.
     * @param rotation Optional resting orientation: a Quaternion, or a Vector3 of Euler angles in degrees.
     * @param amount Optional number of units in the stack, from 1 to 10000; omitted lays down one. A stack is picked up whole.
     * @param virtualWorld Optional virtual world the stack belongs to; omitted puts it in the global one.
     * @param properties Optional condition of the item itself: `quality` as the game grades it, `health` and `condition` from 0 to 1. Each defaults to the class's own. Arrows and other missile classes are held to tighter bounds by the receiving client and are given a quality of 1 and full health when these are left out, since a stack outside those bounds is one no client would build.
     * @returns The newly spawned ground item handle. Throws when the item is not a class in the game's tables, or when no client could build the stack as described.
     */
    static spawn(item: string, position?: Vector3 | Partial<Vector3>, rotation?: Vector3 | Quaternion, amount?: number, virtualWorld?: number, properties?: { quality?: number; health?: number; condition?: number }): GroundItem;

    /**
     * Lists every stack lying in the world, however it got there.
     * @returns One handle per live stack, in no particular order.
     */
    static all(): GroundItem[];

    /**
     * Looks a stack up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The stack's handle, or null when no live stack has that ID.
     */
    static getById(id: number): GroundItem | null;

    /**
     * Removes stacks from the world, emitting groundItemDestroy for each one.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many stacks were removed.
     */
    static destroyAll(virtualWorld?: number): number;
  }

  interface GroundItem extends Entity {}

  /** */
  interface NearestDoor {
    /**
     * Whether the client had a door in sight and it belongs to this level.
     */
    found: boolean;

    /**
     * Why there is no door: nothing in sight, another level, no answer, or a caller who left. Empty when one was found.
     */
    reason: string;

    /**
     * The door handle. Null whenever `found` is false.
     */
    door: Door | null;

    /**
     * The door's level EntityGuid as hex, present only when one was found.
     */
    guid: string | undefined;

    /**
     * The name the level gives the door, often empty. Present only when one was found.
     */
    name: string | undefined;

    /**
     * How far the player is from it, in metres. Present only when one was found.
     */
    distance: number | undefined;

    /**
     * Whether it is standing open, as the client at it sees right now. Present only when one was found.
     */
    open: boolean | undefined;

    /**
     * Whether it is locked, as the client at it sees right now. Present only when one was found.
     */
    locked: boolean | undefined;
  }

  /**
   * Replicated handle for one of the level's own doors.
   */
  class Door {
    /**
     * Creates a script wrapper for a door the server already knows; doors are the level's own and are never spawned.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The level's own EntityGuid, as sixteen lowercase hex digits. The same on every machine, so it is the identity to store a door under; `Door.find` takes it back.
     */
    readonly guid: string;

    /**
     * Bumped on every durable change. Clients act on the edges rather than the value, so it only tells one change from the next.
     */
    readonly stateToken: number;

    /**
     * Whether the door is standing open. Change it with `setOpen`, which also says which way it swings.
     */
    readonly open: boolean;

    /**
     * Which side the leaf was last worked from, which decides the way it swings. A player arriving later poses the door from this, so everyone sees it swung the same way.
     */
    readonly openedFromFront: boolean;

    /**
     * Whether the door is locked. Assignment reaches every client that has the door streamed in, including one already standing at it. A door locked from here can only be opened again from here or with a lockpick: a player unlocking it by hand or with a key is refused.
     */
    locked: boolean;

    /**
     * Whether the lock was set by a script or an operator rather than by the level. It clears when the door is unlocked, by any route the server accepted.
     */
    readonly lockedByServer: boolean;

    /**
     * The entity name the level gives the door.
     */
    readonly name: string;

    /**
     * The item class GUID of the key the level assigns to the door's keyhole, as `player.giveItem` takes it. Empty when it takes none of its own -- most doors open to the generated home or shop key instead. The server does not see inventories, so this is for a resource that keeps its own.
     */
    readonly keyItem: string;

    /**
     * Whether the level lets this door be lockpicked. A lockpick reported on one that cannot be is refused.
     */
    readonly lockpickable: boolean;

    /**
     * Whether the level builds this door locked, which is the state it has at boot.
     */
    readonly startsLocked: boolean;

    /**
     * Formats this door handle for logging and debugging.
     * @returns The door ID, its level GUID and whether it is open and locked.
     */
    toString(): string;

    /**
     * Opens or closes the door with nobody pushing it. Every client that has the door built plays the game's own swing; one arriving later finds it posed the same way. Opening a locked door unlocks it, as the game's own `Open` does.
     * @param open True to open the door, false to close it.
     * @param fromFront Which side the leaf is worked from, and so which way it swings. Omitted keeps the side it was last worked from.
     * @returns False when the door is already that way.
     */
    setOpen(open: boolean, fromFront?: boolean): boolean;

    /**
     * Lists every door the level places, all of which exist from boot in the global world. In another virtual world a door is built the first time anything there reaches it, so this lists only those.
     * @returns One handle per known door, in no particular order.
     */
    static all(): Door[];

    /**
     * Looks a door up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The door's handle, or null when no live door has that ID.
     */
    static getById(id: number): Door | null;

    /**
     * Looks a door up by the level's own identity for it, which survives a restart and is the same on every machine. A door the level places is always found, in any virtual world.
     * @param guid The door's level EntityGuid as hex, with or without an `0x` prefix, as `door.guid` prints it.
     * @param virtualWorld Optional virtual world to look in; omitted looks in the global one, where every body starts.
     * @returns The door's handle, or null when the level places no such door.
     */
    static find(guid: string, virtualWorld?: number): Door | null;

    /**
     * Asks a player's client which door their body is standing at. The server knows every door the level places but has no world to measure distances in, so this is how a command finds the door in front of a player, and the answer is what that client sees now rather than what the replica last carried.
     * 
     * The promise always settles: on the answer, on a five-second timeout, or when the player leaves, with `found` false and `reason` saying which.
     * @param player The player to ask. The question goes to their own client.
     * @returns The answer, once that client has given one.
     */
    static queryNearest(player: Player): Promise<NearestDoor>;
  }

  interface Door extends Entity {}

  /** */
  interface GateToggle {
    /**
     * Whether a cycle started.
     */
    accepted: boolean;

    /**
     * Why nothing moved, as a phrase that reads after the gate's name: `is already open`, `is already closing`. Empty when a cycle started.
     */
    reason: string;

    /**
     * The direction taken, or the one that was refused.
     */
    opening: boolean;

    /**
     * How long the motion still has to run. 0 when nothing moved.
     */
    seconds: number;
  }

  /**
   * Replicated handle for one of the level's animated gates.
   */
  class Gate {
    /**
     * Creates a script wrapper for a gate the server already knows; gates are the level's own and are never spawned.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The level's own EntityGuid, as sixteen lowercase hex digits. The same on every machine, so it is the identity to store a gate under; `Gate.find` takes it back.
     */
    readonly guid: string;

    /**
     * What piece of architecture this is: `drawbridge` or `portcullis`. The shipped game has two in total.
     */
    readonly kind: string;

    /**
     * Where the gate is in its cycle: `closed`, `opening`, `open` or `closing`. Open always means passable -- a portcullis raised, a drawbridge lowered. Named `cycle` because every entity already has a `state`, which is its state bag.
     */
    readonly cycle: string;

    /**
     * How far open the gate is, from 0 shut to 1 fully open, read off the pose curve mined from the asset's own animation at the point the server clock says the motion has reached. It follows the bars, not the clock: a portcullis reads 0 within the first fifth of its close, and holds there while the clip finishes.
     */
    readonly openness: number;

    /**
     * Whether a cycle is running. `toggle` reverses a moving gate from where it has got to rather than refusing it.
     */
    readonly moving: boolean;

    /**
     * How long opening takes, in seconds, from the key range the asset's animation database stores. A gate with no opening clip runs its closing one backwards, so this is that clip's length.
     */
    readonly openDuration: number;

    /**
     * How long closing takes, in seconds, from the asset's animation database.
     */
    readonly closeDuration: number;

    /**
     * Formats this gate handle for logging and debugging.
     * @returns The gate ID, its level GUID, what kind it is and where it is in its cycle.
     */
    toString(): string;

    /**
     * Starts a cycle. The motion is never streamed: every client plays it out from the server clock it started on, and a gate reversed mid-cycle picks up where it is rather than snapping to the far end.
     * @param open true opens, false closes. Omitted heads away from whichever end the gate is at, reversing one already moving.
     * @returns What happened, and the phrase to explain it with when nothing did.
     */
    toggle(open?: boolean): GateToggle;

    /**
     * Lists every gate the level places, all of which exist from boot in the global world. In another virtual world a gate is built the first time anything there reaches it, so this lists only those.
     * @returns One handle per gate, in no particular order.
     */
    static all(): Gate[];

    /**
     * Looks a gate up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The gate's handle, or null when no live gate has that ID.
     */
    static getById(id: number): Gate | null;

    /**
     * Looks a gate up by the level's own identity for it, which survives a restart and is the same on every machine. A gate the level places is always found, in any virtual world.
     * @param guid The gate's level EntityGuid as hex, with or without an `0x` prefix, as `gate.guid` prints it.
     * @param virtualWorld Optional virtual world to look in; omitted looks in the global one, where every body starts.
     * @returns The gate's handle, or null when the level places no such gate.
     */
    static find(guid: string, virtualWorld?: number): Gate | null;

    /**
     * Finds the gate nearest a point. Gate positions come from the level's own data, so unlike a door this needs no round trip to anybody's client.
     * @param position World-space point to measure from.
     * @param radius How far to look, in metres. Castle architecture is visible from a long way off, so this is tens of metres rather than a couple.
     * @param virtualWorld Optional virtual world to look in; omitted looks in the global one.
     * @returns The nearest gate within the radius, or null when there is none.
     */
    static nearest(position: Vector3 | Partial<Vector3>, radius: number, virtualWorld?: number): Gate | null;
  }

  interface Gate extends Entity {}

  /**
   * Replicated container handle.
   */
  class Stash {
    /**
     * Creates a script wrapper for an existing container with this ID; use Stash.spawn() to spawn one.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * The identity every client turns into the same native container. Minted by the server from 1, and not `id`, which is the replication entity's.
     */
    readonly stashId: number;

    /**
     * How many stacks the server is holding. Contents are not replicated -- they are pulled when a player opens the container and pushed back when they close it -- so this is the only view of what is in one.
     */
    readonly itemCount: number;

    /**
     * The network ID of the player who has it open, or 0. While it is held, the game's own lock keeps every other client out.
     */
    readonly holderId: number;

    /**
     * Formats this container handle for logging and debugging.
     * @returns The stash ID, its shared identity, how much is in it and who has it open.
     */
    toString(): string;

    /**
     * Despawns this container on every client and forgets what was in it. Anything inside goes with it.
     */
    destroy(): void;

    /**
     * Spawns and replicates an empty container. Empty by design: an item class is a 16-byte engine GUID only the game's own parser turns from text, and the server has no game to ask. Fill one by having a player put things in it.
     * @param position Optional world-space spawn position; omitted components default to zero.
     * @param rotation Optional initial orientation: a Quaternion, or a Vector3 of Euler angles in degrees.
     * @param virtualWorld Optional virtual world the container belongs to; omitted puts it in the global one.
     * @returns The newly spawned container handle.
     */
    static spawn(position?: Vector3 | Partial<Vector3>, rotation?: Vector3 | Quaternion, virtualWorld?: number): Stash;

    /**
     * Lists every container the server currently has.
     * @returns One handle per live container, in no particular order.
     */
    static all(): Stash[];

    /**
     * Looks a container up by its network entity ID.
     * @param id Network entity identifier.
     * @returns The container's handle, or null when no live container has that ID.
     */
    static getById(id: number): Stash | null;

    /**
     * Despawns containers, and everything in them with them.
     * @param virtualWorld Optional virtual world to clear; omitted clears every one of them.
     * @returns How many containers were removed.
     */
    static destroyAll(virtualWorld?: number): number;
  }

  interface Stash extends Entity {}

  /**
   * The server's own clock and weather, which every client follows, and the three questions it can ask a client's engine about the level itself.
   */
  const World: {
    /**
     * Whole days the clock has run, from the level's own midnight. Starts at 0 and only grows.
     */
    readonly day: number;

    /**
     * Hour within the current day, from 0 up to but not including 24, with the minutes as the fraction. 13.5 is half past one.
     */
    readonly hour: number;

    /**
     * How many game seconds pass per real second. 15 is the game's own pace, 0 stops the clock, and the server drops it to 0 by itself at the clock's ceiling.
     */
    readonly timeScale: number;

    /**
     * The time-of-day preset the sky is blending towards, which is where it settles. Set it with `setWeather`.
     */
    readonly weather: string;

    /**
     * The preset the sky is blending from; the same as `weather` once it has settled.
     */
    readonly previousWeather: string;

    /**
     * Whether a blend is still running. `setWeather` is refused while it is: a half-finished blend has no single preset to leave from.
     */
    readonly weatherBlending: boolean;

    /**
     * Game seconds left of the blend, and 0 once the sky has settled. `setWeather` is refused until then.
     */
    readonly weatherRemaining: number;

    /**
     * How hard it is raining, from 0 to 1.
     */
    readonly rainIntensity: number;

    /**
     * How much of the rain is drawn, from 0 to 1. Thins the downpour without stopping it.
     */
    readonly rainAmount: number;

    /**
     * The wind every client is blowing, in metres per second, world space. It bends the trees, drags the cloth and slants the rain, and it is the one part of the weather the game itself never touches. Set it with `setWind`.
     */
    readonly wind: Vector3;

    /**
     * How hard the wind is blowing, whichever way: the length of `wind`, from 0 to 50.
     */
    readonly windSpeed: number;

    /**
     * How wet the ground has become, from 0 to 3. Derived from how long it has been raining, so it is read-only, and it dries far slower than it soaks.
     */
    readonly wetness: number;

    /**
     * Puddle coverage, from 0 to 1. Derived like `wetness`, and only starts filling after the rain has run a while.
     */
    readonly puddles: number;

    /**
     * Winds the clock forward to an absolute day and hour, which is how a saved clock is restored.
     * @param day Absolute day to wind forward to, as the `day` property counts them. Must be whole.
     * @param hour Hour of that day, from 0 up to but not including 24.
     * @returns True when the clock moved; false when that moment is already past, or the day or hour is out of range.
     */
    setTime(day: number, hour: number): boolean;

    /**
     * Winds the clock forward to the next time it is this hour, rolling into tomorrow when it has passed today. The clock never runs backwards: clients cannot be wound back with it.
     * @param hour Hour to wind forward to, from 0 up to but not including 24.
     * @returns True when the clock moved; false when the hour is out of range.
     */
    setHour(hour: number): boolean;

    /**
     * Sets how fast the day passes for everyone.
     * @param scale Game seconds per real second, from 0 to 200. 0 freezes the clock where it stands.
     * @returns True when the scale was taken; false when it is out of range.
     */
    setTimeScale(scale: number): boolean;

    /**
     * Blends the sky to another of the game's time-of-day presets, and raises `worldWeatherChange`. Only a client can tell whether a preset exists, so a name the game does not know leaves every sky where it is.
     * @param preset Name of one of the game's own time-of-day presets, such as `cloudless_sunny`.
     * @param seconds Game seconds to blend over, up to 21600. Omitted, the sky changes at once.
     * @returns True when the blend started; false while an earlier one is still running, or when the name or duration is out of range.
     */
    setWeather(preset: string, seconds?: number): boolean;

    /**
     * Sets the rain, which is separate from the sky preset: a preset can be overcast without a drop falling. Starting or stopping it restarts the phase the ground soaks and dries over.
     * @param intensity How hard it rains, from 0 to 1. 0 stops it.
     * @param amount How much of the rain is drawn, from 0 to 1; defaults to all of it.
     * @returns True when the rain was taken; false when either value is out of range.
     */
    setRain(intensity: number, amount?: number): boolean;

    /**
     * Sets the wind for everyone. There is nothing to blend against -- the engine takes a vector and holds it -- so a gust is a script ramping this itself. It also drives a physical wind area, which is why the length is capped.
     * @param wind Wind velocity in metres per second, world space; omitted components are zero. Its length may not exceed 50.
     * @returns True when the wind was taken; false when a component is not finite or it blows harder than 50 m/s.
     */
    setWind(wind: Vector3 | Partial<Vector3>): boolean;

    /**
     * Traces a segment through the world and reports the first thing it meets.
     * 
     * The server has no world of its own, so this asks that player's client and waits for it to answer. Three things follow: the answer is a round trip late; it covers only what that machine has streamed in, so a point far from the player reads as empty world; and it is a client's word, which is fine for a prompt and is not fine for anything a player gains by lying about. The promise always settles -- on the answer, on a five-second timeout, or when the player leaves -- and `answered` says which.
     * @param player Whose client is asked. Their machine is the one that answers, so pick a player near the point in question.
     * @param from Where the ray starts, in world-space metres.
     * @param to Where it ends. Up to 4096 metres away; a ray of no length is refused.
     * @param options `mode` picks which of the game's own three traces to run: `cover` asks whether the world is in the way -- static geometry, props and doors block, and bodies cannot, which is what a line of sight wants; `anything` asks what is under the ray, bodies included, which is what a pick wants; `ground` sees only surfaces a player could stand on. It defaults to `cover`, and a name that is none of the three is rejected rather than guessed at.
     * @returns The trace, once that client has run it.
     */
    raycast(player: Player, from: Vector3, to: Vector3, options?: { mode?: "cover" | "anything" | "ground" }): Promise<WorldTraceResult>;

    /**
     * Traces a segment and reports everything solid along it, nearest first.
     * 
     * The server has no world of its own, so this asks that player's client and waits for it to answer. Three things follow: the answer is a round trip late; it covers only what that machine has streamed in, so a point far from the player reads as empty world; and it is a client's word, which is fine for a prompt and is not fine for anything a player gains by lying about. The promise always settles -- on the answer, on a five-second timeout, or when the player leaves -- and `answered` says which.
     * @param player Whose client is asked. Their machine is the one that answers, so pick a player near the point in question.
     * @param from Where the ray starts, in world-space metres.
     * @param to Where it ends. Up to 4096 metres away; a ray of no length is refused.
     * @param options `mode` is as `World.raycast` documents it. `maxHits` is how many things along the ray to report, up to 8 and 8 by default; each is a separate solid hit, found by re-tracing past the one before, so a window does not hide the wall it is set in.
     * @returns The trace, once that client has run it.
     */
    raycastAll(player: Player, from: Vector3, to: Vector3, options?: { mode?: "cover" | "anything" | "ground"; maxHits?: number }): Promise<WorldTraceResult>;

    /**
     * What is underfoot at a point: its height in `hit.position.z`, the slope it landed on, and what the surface is made of.
     * 
     * A trace rather than a terrain height, so it stands on whatever is actually there -- a bridge, a floor, a castle roof -- and not on the heightmap underneath it. There is no bare-number form here, because a promise has to be able to say that nothing answered.
     * 
     * The server has no world of its own, so this asks that player's client and waits for it to answer. Three things follow: the answer is a round trip late; it covers only what that machine has streamed in, so a point far from the player reads as empty world; and it is a client's word, which is fine for a prompt and is not fine for anything a player gains by lying about. The promise always settles -- on the answer, on a five-second timeout, or when the player leaves -- and `answered` says which.
     * @param player Whose client is asked. Their machine is the one that answers, so pick a player near the point in question.
     * @param position The point to look under, in world-space metres. Its own z is where the probe is centred.
     * @param options How far above the point the probe starts and how far below it reaches, in metres. 5 and 200 by default -- the 5 above is what lets a point already slightly underground still resolve -- and up to 512 each.
     * @returns The probe, once that client has run it.
     */
    resolveGround(player: Player, position: Vector3, options?: { up?: number; down?: number }): Promise<WorldTraceResult>;

    /**
     * The server's own replicated entities near a point, nearest first -- players, horses, dogs, props, dropped items, doors, gates and stashes, each as its own handle.
     * 
     * This needs no client: the server already knows where its replicas are, so unlike `entitiesInRadius` it is immediate and authoritative. It sees only what the server replicates, which is the other half -- the level's own entities are what `entitiesInRadius` is for.
     * @param position World-space point to measure from.
     * @param radius How far to look, in metres.
     * @param virtualWorld Optional virtual world to look in; omitted looks in the global one, where every body starts.
     * @returns The handles, nearest first.
     */
    replicasInRadius(position: Vector3, radius: number, virtualWorld?: number): Entity[];

    /**
     * Every entity that client's engine has inside a sphere, nearest first.
     * 
     * It reads the engine's own spatial grid, so it costs what the sphere covers rather than what the level holds. This reports the level's entities -- doors, props, bodies -- and not the server's replicas; correlate them by `guid`.
     * 
     * The server has no world of its own, so this asks that player's client and waits for it to answer. Three things follow: the answer is a round trip late; it covers only what that machine has streamed in, so a point far from the player reads as empty world; and it is a client's word, which is fine for a prompt and is not fine for anything a player gains by lying about. The promise always settles -- on the answer, on a five-second timeout, or when the player leaves -- and `answered` says which.
     * @param player Whose client is asked. Their machine is the one that answers, so pick a player near the point in question.
     * @param centre The centre of the sphere, in world-space metres.
     * @param radius Its radius in metres, up to 256.
     * @param options `class` reports only entities of that engine class -- `AnimDoor`, `NPC_NAI`, `GeomEntity` -- and a class the engine does not know matches nothing rather than everything; omitted, every class is reported. `max` is how many to report, nearest first, up to 64. `physicalOnly` skips entities the engine has built no physics for, which is the filter the game's own proximity query applies, and is off by default.
     * @returns The entities, once that client has looked.
     */
    entitiesInRadius(player: Player, centre: Vector3, radius: number, options?: { class?: string; max?: number; physicalOnly?: boolean }): Promise<WorldRadiusResult>;
  };

  /**
   * One thing a trace met, as the machine that traced it saw it.
   */
  interface WorldRayHit {
    /**
     * Where the ray met it, in world-space metres.
     */
    position: Vector3;

    /**
     * The surface normal at that point, as a unit vector.
     */
    normal: Vector3;

    /**
     * How far along the ray it sits, in metres.
     */
    distance: number;

    /**
     * The surface type's own name, spelled the way the game's tables spell it -- `mat_wood`, `mat_stone`, `mat_water`. This is what a trace is worth over a position: it says what was hit, not just where. Empty only before the material tables are up.
     */
    surface: string;

    /**
     * Whether the ground itself was hit rather than anything placed on it. Nothing lies behind the terrain, so a trace stops there.
     */
    terrain: boolean;

    /**
     * The level's own identity for what was hit, as sixteen lowercase hex digits -- the same on every machine, and what `Door.find` and the other GUID lookups take. Null for terrain, for static geometry and for anything the session spawned, none of which the level names.
     */
    entityGuid: string | null;

    /**
     * The name the level gives it, often empty. Null when nothing that carries a name was hit.
     */
    entityName: string | null;

    /**
     * The engine class it belongs to -- `AnimDoor`, `NPC_NAI`, `GeomEntity`. Null when nothing that carries a class was hit.
     */
    entityClass: string | null;
  }

  /**
   * One entity a sphere reported, and where it stood when it did.
   */
  interface WorldNearbyEntity {
    /**
     * Where it is, in world-space metres.
     */
    position: Vector3;

    /**
     * How far it is from the centre of the sphere, in metres.
     */
    distance: number;

    /**
     * The level's own identity for it, as sixteen lowercase hex digits. Null for anything the session spawned, which the level does not name.
     */
    guid: string | null;

    /**
     * The name the level gives it, often empty.
     */
    name: string;

    /**
     * The engine class it belongs to -- `AnimDoor`, `NPC_NAI`, `GeomEntity`.
     */
    class: string;

    /**
     * Whether the engine has built physics for it, which is what makes it something a trace could also find.
     */
    physicalized: boolean;
  }

  /**
   * What a trace came back with, and whether it came back at all.
   */
  interface WorldTraceResult {
    /**
     * Whether the client ran the trace. False when it has no world loaded, is in another level, did not answer in time, or left.
     */
    answered: boolean;

    /**
     * Why it did not answer. Empty when it did.
     */
    reason: string;

    /**
     * The nearest thing the ray met, or null when it met nothing and whenever `answered` is false.
     */
    hit: WorldRayHit | null;

    /**
     * Everything it met, nearest first. One entry at most unless `maxHits` asked for more; empty whenever `answered` is false.
     */
    hits: WorldRayHit[];
  }

  /**
   * What a sphere came back with, and whether it came back at all.
   */
  interface WorldRadiusResult {
    /**
     * Whether the client ran the query. False when it has no world loaded, is in another level, did not answer in time, or left.
     */
    answered: boolean;

    /**
     * Why it did not answer. Empty when it did.
     */
    reason: string;

    /**
     * The entities inside the sphere, nearest first. Empty whenever `answered` is false.
     */
    entities: WorldNearbyEntity[];
  }

  /**
   * What the game's own tables say about one status effect.
   */
  interface BuffInfo {
    /**
     * The name the game's own buff tables give the effect, and the spelling every buff verb takes.
     */
    name: string;

    /**
     * The kind of effect it is -- `poison`, `alcohol`, `injury`, `potion`. `Buffs.classes` lists the ones a server can take over.
     */
    class: string;

    /**
     * The family `player.clearBuffs` would take it off with, or null for the majority that belong to none.
     */
    aiTag: string | null;

    /**
     * How long the effect runs from start to finish, in real seconds, and negative for one with no end.
     */
    duration: number;
  }

  /**
   * One status effect currently on a body: everything `BuffInfo` says about it, plus how long it has been there and who put it there.
   */
  interface BuffState {
    /**
     * The name the game's own buff tables give the effect, and the spelling every buff verb takes.
     */
    name: string;

    /**
     * The kind of effect it is -- `poison`, `alcohol`, `injury`, `potion`. `Buffs.classes` lists the ones a server can take over.
     */
    class: string;

    /**
     * The family `player.clearBuffs` would take it off with, or null for the majority that belong to none.
     */
    aiTag: string | null;

    /**
     * How long the effect runs from start to finish, in real seconds, and negative for one with no end.
     */
    duration: number;

    /**
     * How long it has been on the body, in real seconds. `duration - since` is roughly what is left, and roughly is the best anyone can do: the game advances buff time from each client's own frame delta. 0 for an effect that was already there when the player connected.
     */
    since: number;

    /**
     * Whether this server put it there, or the game did -- a potion they drank, an injury they took.
     */
    source: "server" | "native";
  }

  /**
   * The game's status-effect table, and which of it this server decides.
   */
  const Buffs: {
    /**
     * The kinds of effect a server can take over, which is what `claim` accepts: the ones carrying state nobody can work out for themselves -- potions, poison, injury, drunkenness, illness, unconsciousness. The game has other kinds, and they read back in `BuffInfo.class`, but they either shadow something that already replicates or are the game's own plumbing, so there is no decision in them to take.
     */
    readonly classes: string[];

    /**
     * The families the game groups effects into, which is what `player.clearBuffs` takes: `poison`, `bleed`, `alcohol_drunk`, `unconscious` and nineteen more. These are the game's own words, and its own AI reasons in them.
     */
    readonly tags: string[];

    /**
     * Looks a status effect up, so a resource can check a name is real before handing it to a player and can see what the effect is before applying it.
     * @param query An effect's name, as the game's buff tables spell it, or its GUID.
     * @returns What the tables say about it, or null for a name they do not carry.
     */
    find(query: string): BuffInfo | null;

    /**
     * Takes over whole kinds of effect. Every client then turns down an effect of that kind the game tried to give its own player, and raises `playerBuffBlocked` instead -- which is where the resource decides what really happens, usually `player.addBuff` with its own rule applied. A claim nothing listens to does not move the gameplay here, it removes it.
     * 
     * Two things to plan around. The refusal covers the game's follow-on effects too: claim `alcohol` and the six `alcoholism_level*` steps stop arriving along with the drink, so the resource owns the whole progression. And an effect has no strength -- the handler can block it, swap it for another, or let it through, but it cannot make the drink half as strong.
     * 
     * Replaces the previous claim rather than adding to it, and reaches every connected client at once.
     * @param classNames The kinds of effect to decide, from `Buffs.classes`. `[]` hands them all back. Throws for anything else.
     * @returns The kinds now claimed.
     */
    claim(classNames: string[]): string[];
  };

  /**
   * The game's own character-component catalog: every face, hairstyle, beard and skin a player's body can be given.
   * 
   * Everyone on a fresh server is Henry, because a body with nothing chosen is the one the game hands out. This is where the alternatives come from; `player.setAppearance` is what puts one on somebody.
   */
  const Appearances: {
    /**
     * Every option the game ships for one part. The male tree has 212 faces, 262 hairstyles, 51 beards and 47 skins; the female tree has 61, 71, none and 41.
     * 
     * The hairstyle count is large because the game ships each style once per colour rather than colouring one. Group by `option.group` to get the styles back.
     * 
     * The 51 beards are the whole catalog, not what any one body can wear: a beard is modelled per face and only exists for the faces it was modelled for. `Appearances.beards` is the list to show somebody.
     * @param part Which part to list.
     * @param gender Which half of the catalog to read; male by default.
     * @returns The options, in the catalog's own order.
     */
    options(part: "body" | "head" | "hair" | "beard", gender?: "male" | "female"): AppearanceOption[];

    /**
     * The beards that face can actually grow.
     * 
     * A beard is modelled against one head's mesh and stored under that head's own folder, so asking for one the artists never made for the face wearing it does nothing at all -- no error, no beard, a body that comes back clean-shaven. The owning client refuses such a pair outright, so filter a chooser through this rather than through `options("beard")`.
     * 
     * The 164 generic faces carry 24 each, Henry's face carries the 15 the game's own barber offers, and 14 faces carry none.
     * @param head The face to ask about -- a name from `Appearances.options("head")`. Omitted or empty means the face a body nobody has chosen one for wears.
     * @param gender Which half of the catalog the head came from; male by default.
     * @returns The wearable beards, in the catalog's own order. Empty for a female body, for a face with none, and for a name the catalog does not carry.
     */
    beards(head?: string, gender?: "male" | "female"): AppearanceOption[];

    /**
     * Looks one component name up, so a resource can check a name is real before handing it to a player.
     * @param part Which part the name is for.
     * @param name The component name to look up.
     * @param gender Which half of the catalog to look in; male by default.
     * @returns What the catalog says about it, or null for a name it does not carry.
     */
    find(part: "body" | "head" | "hair" | "beard", name: string, gender?: "male" | "female"): AppearanceOption | null;

    /**
     * Picks one option for every part, which is the cheapest way to stop a server full of Henrys. Hand the result straight to `player.setAppearance`.
     * 
     * Uniform over the catalog rather than over what looks good together: the game's own faces and hairstyles are authored for particular NPCs, so a random body is recognisably random. The beard is drawn after the face and only from what that face can wear, so the result is always one a client will accept.
     * @param gender Which half of the catalog to draw from; male by default.
     * @returns A complete appearance. `beard` is empty for a female one, which the catalog has none of, and for the fourteen male faces no beard was modelled for.
     */
    random(gender?: "male" | "female"): Appearance;
  };

  /**
   * Mutable two-dimensional vector.
   */
  class Vector2 {
    /**
     * Creates a vector from two numeric components.
     * @param x Initial X component.
     * @param y Initial Y component.
     */
    constructor(x: number, y: number);

    /**
     * Mutable X component.
     */
    x: number;

    /**
     * Mutable Y component.
     */
    y: number;

    /**
     * Read-only Euclidean magnitude of this vector.
     */
    readonly length: number;

    /**
     * Read-only squared magnitude, avoiding a square-root calculation.
     */
    readonly lengthSquared: number;

    /**
     * Adds another vector to this vector in place.
     * @param other Vector to add component-wise.
     * @returns This mutated vector for chaining.
     */
    add(other: Vector2): this;

    /**
     * Subtracts another vector from this vector in place.
     * @param other Vector to subtract component-wise.
     * @returns This mutated vector for chaining.
     */
    sub(other: Vector2): this;

    /**
     * Multiplies this vector by a scalar in place.
     * @param scalar Multiplier applied to both components.
     * @returns This mutated vector for chaining.
     */
    mul(scalar: number): this;

    /**
     * Divides this vector by a scalar in place.
     * @param scalar Divisor applied to both components; must be non-zero.
     * @returns This mutated vector for chaining.
     */
    div(scalar: number): this;

    /**
     * Computes the dot product without changing either vector.
     * @param other Vector used for the dot product.
     * @returns Scalar dot product.
     */
    dot(other: Vector2): number;

    /**
     * Normalizes this vector in place; a zero vector remains unchanged.
     * @returns This mutated vector for chaining.
     */
    normalize(): this;

    /**
     * Linearly interpolates this vector toward a target in place.
     * @param target Destination vector.
     * @param t Interpolation factor; 0 keeps the current value and 1 reaches target.
     * @returns This mutated vector for chaining.
     */
    lerp(target: Vector2, t: number): this;

    /**
     * Replaces both components in place.
     * @param x Replacement X component.
     * @param y Replacement Y component.
     * @returns This mutated vector for chaining.
     */
    set(x: number, y: number): this;

    /**
     * Computes Euclidean distance to another vector.
     * @param other Vector to measure from this vector.
     * @returns Distance between the two vectors.
     */
    distance(other: Vector2): number;

    /**
     * Creates an independent copy of this vector.
     * @returns New vector with the same components.
     */
    clone(): Vector2;

    /**
     * Formats this vector for logging and debugging.
     * @returns Text in Vector2(x, y) form.
     */
    toString(): string;

    /**
     * Converts this vector to a plain object for JSON.stringify.
     * @returns Object containing the current components.
     */
    toJSON(): { x: number; y: number };

    /**
     * Creates a vector whose components are zero.
     * @returns New Vector2(0, 0).
     */
    static zero(): Vector2;

    /**
     * Creates a vector whose components are one.
     * @returns New Vector2(1, 1).
     */
    static one(): Vector2;
  }

  /**
   * Mutable three-dimensional vector for positions, directions, and Euler angles.
   */
  class Vector3 {
    /**
     * Creates a vector from three numeric components.
     * @param x Initial X component.
     * @param y Initial Y component.
     * @param z Initial Z component.
     */
    constructor(x: number, y: number, z: number);

    /**
     * Mutable X component.
     */
    x: number;

    /**
     * Mutable Y component.
     */
    y: number;

    /**
     * Mutable Z component.
     */
    z: number;

    /**
     * Read-only Euclidean magnitude of this vector.
     */
    readonly length: number;

    /**
     * Read-only squared magnitude, avoiding a square-root calculation.
     */
    readonly lengthSquared: number;

    /**
     * Adds another vector to this vector in place.
     * @param other Vector to add component-wise.
     * @returns This mutated vector for chaining.
     */
    add(other: Vector3): this;

    /**
     * Subtracts another vector from this vector in place.
     * @param other Vector to subtract component-wise.
     * @returns This mutated vector for chaining.
     */
    sub(other: Vector3): this;

    /**
     * Multiplies this vector by a scalar in place.
     * @param scalar Multiplier applied to every component.
     * @returns This mutated vector for chaining.
     */
    mul(scalar: number): this;

    /**
     * Divides this vector by a scalar in place.
     * @param scalar Divisor applied to every component; must be non-zero.
     * @returns This mutated vector for chaining.
     */
    div(scalar: number): this;

    /**
     * Computes the dot product without changing either vector.
     * @param other Vector used for the dot product.
     * @returns Scalar dot product.
     */
    dot(other: Vector3): number;

    /**
     * Replaces this vector with its cross product against another vector.
     * @param other Second vector in the cross product.
     * @returns This mutated perpendicular vector for chaining.
     */
    cross(other: Vector3): this;

    /**
     * Normalizes this vector in place; a zero vector remains unchanged.
     * @returns This mutated vector for chaining.
     */
    normalize(): this;

    /**
     * Linearly interpolates this vector toward a target in place.
     * @param target Destination vector.
     * @param t Interpolation factor; 0 keeps the current value and 1 reaches target.
     * @returns This mutated vector for chaining.
     */
    lerp(target: Vector3, t: number): this;

    /**
     * Replaces all components in place.
     * @param x Replacement X component.
     * @param y Replacement Y component.
     * @param z Replacement Z component.
     * @returns This mutated vector for chaining.
     */
    set(x: number, y: number, z: number): this;

    /**
     * Computes Euclidean distance to another vector.
     * @param other Vector to measure from this vector.
     * @returns Distance between the two vectors.
     */
    distance(other: Vector3): number;

    /**
     * Creates an independent copy of this vector.
     * @returns New vector with the same components.
     */
    clone(): Vector3;

    /**
     * Formats this vector for logging and debugging.
     * @returns Text in Vector3(x, y, z) form.
     */
    toString(): string;

    /**
     * Converts this vector to a plain object for JSON.stringify.
     * @returns Object containing the current components.
     */
    toJSON(): { x: number; y: number; z: number };

    /**
     * Creates a zero vector.
     * @returns New Vector3(0, 0, 0).
     */
    static zero(): Vector3;

    /**
     * Creates a vector whose components are one.
     * @returns New Vector3(1, 1, 1).
     */
    static one(): Vector3;

    /**
     * Creates the framework's positive-Y unit direction.
     * @returns New Vector3(0, 1, 0).
     */
    static up(): Vector3;

    /**
     * Creates the framework's positive-Z unit direction.
     * @returns New Vector3(0, 0, 1).
     */
    static forward(): Vector3;

    /**
     * Creates the framework's positive-X unit direction.
     * @returns New Vector3(1, 0, 0).
     */
    static right(): Vector3;
  }

  /**
   * Mutable four-dimensional vector.
   */
  class Vector4 {
    /**
     * Creates a vector from four numeric components.
     * @param x Initial X component.
     * @param y Initial Y component.
     * @param z Initial Z component.
     * @param w Initial W component.
     */
    constructor(x: number, y: number, z: number, w: number);

    /**
     * Mutable X component.
     */
    x: number;

    /**
     * Mutable Y component.
     */
    y: number;

    /**
     * Mutable Z component.
     */
    z: number;

    /**
     * Mutable W component.
     */
    w: number;

    /**
     * Read-only Euclidean magnitude of this vector.
     */
    readonly length: number;

    /**
     * Read-only squared magnitude, avoiding a square-root calculation.
     */
    readonly lengthSquared: number;

    /**
     * Adds another vector to this vector in place.
     * @param other Vector to add component-wise.
     * @returns This mutated vector for chaining.
     */
    add(other: Vector4): this;

    /**
     * Subtracts another vector from this vector in place.
     * @param other Vector to subtract component-wise.
     * @returns This mutated vector for chaining.
     */
    sub(other: Vector4): this;

    /**
     * Multiplies this vector by a scalar in place.
     * @param scalar Multiplier applied to every component.
     * @returns This mutated vector for chaining.
     */
    mul(scalar: number): this;

    /**
     * Divides this vector by a scalar in place.
     * @param scalar Divisor applied to every component; must be non-zero.
     * @returns This mutated vector for chaining.
     */
    div(scalar: number): this;

    /**
     * Computes the dot product without changing either vector.
     * @param other Vector used for the dot product.
     * @returns Scalar dot product.
     */
    dot(other: Vector4): number;

    /**
     * Computes Euclidean distance to another vector.
     * @param other Vector to measure from this vector.
     * @returns Distance between the two vectors.
     */
    distance(other: Vector4): number;

    /**
     * Normalizes this vector in place; a zero vector remains unchanged.
     * @returns This mutated vector for chaining.
     */
    normalize(): this;

    /**
     * Linearly interpolates this vector toward a target in place.
     * @param target Destination vector.
     * @param t Interpolation factor; 0 keeps the current value and 1 reaches target.
     * @returns This mutated vector for chaining.
     */
    lerp(target: Vector4, t: number): this;

    /**
     * Replaces all components in place.
     * @param x Replacement X component.
     * @param y Replacement Y component.
     * @param z Replacement Z component.
     * @param w Replacement W component.
     * @returns This mutated vector for chaining.
     */
    set(x: number, y: number, z: number, w: number): this;

    /**
     * Creates an independent copy of this vector.
     * @returns New vector with the same components.
     */
    clone(): Vector4;

    /**
     * Formats this vector for logging and debugging.
     * @returns Text in Vector4(x, y, z, w) form.
     */
    toString(): string;

    /**
     * Converts this vector to a plain object for JSON.stringify.
     * @returns Object containing the current components.
     */
    toJSON(): { x: number; y: number; z: number; w: number };

    /**
     * Creates a zero vector.
     * @returns New Vector4(0, 0, 0, 0).
     */
    static zero(): Vector4;

    /**
     * Creates a vector whose components are one.
     * @returns New Vector4(1, 1, 1, 1).
     */
    static one(): Vector4;
  }

  /**
   * Mutable quaternion for three-dimensional rotations. Components are scalar-first (w, x, y, z), matching GLM — not the x, y, z, w order some libraries use.
   */
  class Quaternion {
    /**
     * Creates a quaternion in scalar-first w, x, y, z component order. Watch the trap: the scalar w is the first argument, unlike the x, y, z, w order used by some other libraries.
     * @param w Initial scalar component (comes first — this is not x, y, z, w order).
     * @param x Initial X imaginary component.
     * @param y Initial Y imaginary component.
     * @param z Initial Z imaginary component.
     */
    constructor(w: number, x: number, y: number, z: number);

    /**
     * Mutable scalar component.
     */
    w: number;

    /**
     * Mutable X imaginary component.
     */
    x: number;

    /**
     * Mutable Y imaginary component.
     */
    y: number;

    /**
     * Mutable Z imaginary component.
     */
    z: number;

    /**
     * Read-only magnitude (norm) of this quaternion; 1 for a unit rotation.
     */
    readonly length: number;

    /**
     * Read-only squared magnitude, avoiding a square-root calculation.
     */
    readonly lengthSquared: number;

    /**
     * Composes this rotation with another quaternion in place.
     * @param other Rotation composed after this quaternion.
     * @returns This mutated quaternion for chaining.
     */
    mul(other: Quaternion): this;

    /**
     * Normalizes this quaternion in place; a zero quaternion becomes the identity rotation instead of NaN.
     * @returns This unit quaternion for chaining.
     */
    normalize(): this;

    /**
     * Computes the conjugate without changing this quaternion.
     * @returns New conjugated quaternion.
     */
    conjugate(): Quaternion;

    /**
     * Computes the inverse rotation without changing this quaternion.
     * @returns New inverse quaternion.
     */
    inverse(): Quaternion;

    /**
     * Spherically interpolates this quaternion toward a target in place.
     * @param target Destination rotation.
     * @param t Interpolation factor; 0 keeps the current rotation and 1 reaches target.
     * @returns This mutated quaternion for chaining.
     */
    slerp(target: Quaternion, t: number): this;

    /**
     * Computes the quaternion dot product.
     * @param other Quaternion used for the dot product.
     * @returns Scalar dot product.
     */
    dot(other: Quaternion): number;

    /**
     * Applies this rotation to a vector without mutating either value.
     * @param vector Vector to rotate.
     * @returns New rotated vector.
     */
    rotateVector(vector: Vector3): Vector3;

    /**
     * Converts this rotation to Euler angles in radians.
     * @returns Pitch, yaw, and roll as a Vector3.
     */
    toEuler(): Vector3;

    /**
     * Replaces all quaternion components in place.
     * @param w Replacement scalar component.
     * @param x Replacement X imaginary component.
     * @param y Replacement Y imaginary component.
     * @param z Replacement Z imaginary component.
     * @returns This mutated quaternion for chaining.
     */
    set(w: number, x: number, y: number, z: number): this;

    /**
     * Creates an independent copy of this quaternion.
     * @returns New quaternion with the same components.
     */
    clone(): Quaternion;

    /**
     * Formats this quaternion for logging and debugging.
     * @returns Text in Quaternion(w, x, y, z) form.
     */
    toString(): string;

    /**
     * Converts this quaternion to a plain object for JSON.stringify.
     * @returns Object containing the current components.
     */
    toJSON(): { w: number; x: number; y: number; z: number };

    /**
     * Creates the identity rotation.
     * @returns New Quaternion(1, 0, 0, 0).
     */
    static identity(): Quaternion;

    /**
     * Creates a rotation from Euler angles.
     * @param pitch Pitch angle in radians.
     * @param yaw Yaw angle in radians.
     * @param roll Roll angle in radians.
     * @returns New rotation quaternion.
     */
    static fromEuler(pitch: number, yaw: number, roll: number): Quaternion;

    /**
     * Creates a rotation around an axis.
     * @param axis Rotation axis; it is normalized internally.
     * @param angle Rotation angle in radians.
     * @returns New axis-angle rotation quaternion.
     */
    static fromAxisAngle(axis: Vector3, angle: number): Quaternion;
  }

  /**
   * Mutable RGBA color, with components stored from 0 to 1.
   */
  class Color {
    /**
     * Creates a color from normalized RGBA components.
     * @param r Initial red component from 0 to 1.
     * @param g Initial green component from 0 to 1.
     * @param b Initial blue component from 0 to 1.
     * @param a Optional alpha component from 0 to 1; defaults to 1.
     */
    constructor(r: number, g: number, b: number, a?: number);

    /**
     * Mutable normalized red component.
     */
    r: number;

    /**
     * Mutable normalized green component.
     */
    g: number;

    /**
     * Mutable normalized blue component.
     */
    b: number;

    /**
     * Mutable normalized alpha component.
     */
    a: number;

    /**
     * Linearly interpolates every component toward a target in place.
     * @param target Destination color.
     * @param t Interpolation factor; 0 keeps this color and 1 reaches target.
     * @returns This mutated color for chaining.
     */
    lerp(target: Color, t: number): this;

    /**
     * Replaces this color's normalized components in place.
     * @param r Replacement red component from 0 to 1.
     * @param g Replacement green component from 0 to 1.
     * @param b Replacement blue component from 0 to 1.
     * @param a Optional replacement alpha; defaults to 1 when omitted.
     * @returns This mutated color for chaining.
     */
    set(r: number, g: number, b: number, a?: number): this;

    /**
     * Creates an independent copy of this color.
     * @returns New color with the same components.
     */
    clone(): Color;

    /**
     * Converts normalized components to a hexadecimal CSS-style string.
     * @param includeAlpha Whether to append the alpha byte; defaults to false.
     * @returns Lowercase #rrggbb or #rrggbbaa string.
     */
    toHex(includeAlpha?: boolean): string;

    /**
     * Formats this color for logging and debugging.
     * @returns Text in Color(r, g, b, a) form.
     */
    toString(): string;

    /**
     * Converts this color to a plain object for JSON.stringify.
     * @returns Object containing the current normalized components.
     */
    toJSON(): { r: number; g: number; b: number; a: number };

    /**
     * Parses a hexadecimal color string.
     * @param hex Hexadecimal color in #RRGGBB or #RRGGBBAA form; the leading # is optional. Three- and four-digit shorthands are not supported.
     * @returns Parsed color, or opaque white when the input is invalid.
     */
    static fromHex(hex: string): Color;

    /**
     * Creates a normalized color from byte components.
     * @param r Red byte from 0 to 255.
     * @param g Green byte from 0 to 255.
     * @param b Blue byte from 0 to 255.
     * @param a Optional alpha byte from 0 to 255; defaults to 255.
     * @returns New normalized color.
     */
    static fromRGB(r: number, g: number, b: number, a?: number): Color;

    /**
     * Creates opaque white.
     * @returns New Color(1, 1, 1, 1).
     */
    static white(): Color;

    /**
     * Creates opaque black.
     * @returns New Color(0, 0, 0, 1).
     */
    static black(): Color;

    /**
     * Creates opaque red.
     * @returns New Color(1, 0, 0, 1).
     */
    static red(): Color;

    /**
     * Creates opaque green.
     * @returns New Color(0, 1, 0, 1).
     */
    static green(): Color;

    /**
     * Creates opaque blue.
     * @returns New Color(0, 0, 1, 1).
     */
    static blue(): Color;

    /**
     * Creates opaque yellow.
     * @returns New Color(1, 1, 0, 1).
     */
    static yellow(): Color;

    /**
     * Creates opaque cyan.
     * @returns New Color(0, 1, 1, 1).
     */
    static cyan(): Color;

    /**
     * Creates opaque magenta.
     * @returns New Color(1, 0, 1, 1).
     */
    static magenta(): Color;

    /**
     * Creates fully transparent black.
     * @returns New Color(0, 0, 0, 0).
     */
    static transparent(): Color;
  }

  /**
   * Typed request and notification channel between local resources through the global Messages object.
   */
  const Messages: {
    /**
     * Registers or replaces a message handler owned by the calling resource.
     * @param messageType Message type unique within the receiving resource.
     * @param handler Handler invoked with the payload and a reply callback; the reply is ignored for notifications.
     */
    handle(messageType: string, handler: MessageHandler): void;

    /**
     * Sends a request to another local resource and waits for its handler to call reply.
     * @param resourceName Destination running resource.
     * @param messageType Handler type registered by the destination.
     * @param payload Optional payload delivered to the handler.
     * @returns Promise resolved with the reply value or rejected when delivery or handling fails.
     */
    request(resourceName: string, messageType: string, payload?: unknown): Promise<unknown>;

    /**
     * Sends a fire-and-forget notification to another local resource.
     * @param resourceName Destination running resource.
     * @param messageType Handler type registered by the destination.
     * @param payload Optional payload delivered to the handler.
     */
    send(resourceName: string, messageType: string, payload?: unknown): void;
  };

  /**
   * Bulk access to values exported by another running resource through the global Imports object.
   */
  const Imports: {
    /**
     * Builds an object containing every currently registered export from another resource; undeclared dependencies produce a warning.
     * @param resourceName Name of the running resource whose exports should be read.
     * @returns Object keyed by export name, or an empty object when the resource has no exports.
     */
    get(resourceName: string): Record<string, unknown>;
  };

  /**
   * Registration and lookup of cross-resource values through the global Exports object.
   */
  const Exports: {
    /**
     * Registers a value from the calling resource for use by dependent resources.
     * @param name Export name, preferably declared in the current resource manifest.
     * @param value JavaScript value or function retained by the current resource.
     * @returns True when the value was registered.
     */
    register(name: string, value: unknown): boolean;

    /**
     * Reads one registered export from another running resource; undeclared dependencies produce a warning.
     * @param resourceName Name of the running resource that owns the export.
     * @param exportName Registered export name.
     * @returns The exported value.
     */
    get(resourceName: string, exportName: string): unknown;
  };

  /**
   * Resource-aware console that routes output through the Framework logger.
   */
  const console: {
    /**
     * Writes an informational log entry prefixed with the current resource name.
     * @param values Values formatted and joined with spaces.
     */
    log(values?: unknown[]): void;

    /**
     * Alias of console.log for informational output.
     * @param values Values formatted and joined with spaces.
     */
    info(values?: unknown[]): void;

    /**
     * Writes a warning log entry prefixed with the current resource name.
     * @param values Values formatted and joined with spaces.
     */
    warn(values?: unknown[]): void;

    /**
     * Writes an error log entry prefixed with the current resource name.
     * @param values Values formatted and joined with spaces.
     */
    error(values?: unknown[]): void;

    /**
     * Writes a debug log entry prefixed with the current resource name.
     * @param values Values formatted and joined with spaces.
     */
    debug(values?: unknown[]): void;
  };

  /**
   * Runtime-side flags exposed as the global ExecutionEnvironment.
   */
  const ExecutionEnvironment: {
    /**
     * True in the sandboxed client scripting runtime.
     */
    readonly isClient: boolean;

    /**
     * True in the authoritative server scripting runtime.
     */
    readonly isServer: boolean;
  };

  /**
   * Server-side delivery of structured chat messages to connected clients.
   */
  const Chat: {
    /**
     * Broadcasts a structured chat message to all clients.
     * @param text Message body broadcast to every connected client.
     * @param options Optional author label and color: a Color or a packed 0xRRGGBBAA integer.
     */
    sendToAll(text: string, options?: { author?: string; color?: number | Color }): void;

    /**
     * Sends a structured chat message to one player's owning connection.
     * @param player Player-owned entity identifying the destination connection.
     * @param text Message body sent to the player.
     * @param options Optional author label and color: a Color or a packed 0xRRGGBBAA integer.
     */
    sendToPlayer(player: Entity, text: string, options?: { author?: string; color?: number | Color }): void;

    /**
     * Enables or disables the built-in player-to-player chat relay.
     * @param enabled True to relay chat automatically; false to answer playerChat yourself.
     */
    setDefaultRelay(enabled: boolean): void;

    /**
     * Checks whether the built-in chat relay is enabled.
     * @returns True when chat is relayed automatically.
     */
    isDefaultRelay(): boolean;
  };

  /**
   * Server-side proximity voice rules: how far voice carries, and who may talk to or hear whom.
   */
  const Voice: {
    /**
     * Sets how far voice carries for talkers with no override of their own. Connected clients are told, so their playback fades out at the same distance.
     * @param range Audibility radius in world units; values <= 0 restore the default of 25.
     */
    setRange(range: number): void;

    /**
     * Reads the server-wide proximity range.
     * @returns Radius in world units.
     */
    getRange(): number;

    /**
     * Overrides how far one player's voice carries, for whisper and shout modes.
     * @param player Player whose voice carries the given distance.
     * @param range Audibility radius in world units; values <= 0 return them to the server-wide range.
     */
    setPlayerRange(player: Entity, range: number): void;

    /**
     * Reads how far a player's voice carries, with the server-wide default already resolved.
     * @param player Player to query.
     * @returns Radius in world units.
     */
    getPlayerRange(player: Entity): number;

    /**
     * Server-wide mute: a muted player's voice reaches nobody.
     * @param player Player to mute or unmute.
     * @param muted True to stop their voice reaching anyone.
     */
    setPlayerMuted(player: Entity, muted: boolean): void;

    /**
     * Checks the server-wide mute flag.
     * @param player Player to query.
     * @returns True when the player's voice reaches nobody.
     */
    isPlayerMuted(player: Entity): boolean;

    /**
     * Server-wide deafen: a deaf player receives nobody.
     * @param player Player to deafen or undeafen.
     * @param deaf True to stop them receiving anyone's voice.
     */
    setPlayerDeaf(player: Entity, deaf: boolean): void;

    /**
     * Checks the server-wide deafen flag.
     * @param player Player to query.
     * @returns True when the player receives nobody's voice.
     */
    isPlayerDeaf(player: Entity): boolean;

    /**
     * One-way mute between two players, enforced by the server rather than the client.
     * @param listener Player who stops hearing the target.
     * @param target Player the listener stops hearing.
     * @param muted True to mute, false to restore.
     */
    setLocalMute(listener: Entity, target: Entity, muted: boolean): void;

    /**
     * Checks a one-way mute.
     * @param listener Player doing the muting.
     * @param target Player being muted.
     * @returns True when the listener does not receive the target.
     */
    isLocallyMuted(listener: Entity, target: Entity): boolean;

    /**
     * Checks whether a player left voice chat enabled in their own client settings. A preference, not a permission: use setPlayerMuted or setPlayerDeaf to enforce anything.
     * @param player Player to query.
     * @returns True unless the player turned voice chat off.
     */
    isPlayerVoiceEnabled(player: Entity): boolean;

    /**
     * Checks whether a player is speaking right now. Tracks speech rather than the push-to-talk key: silence is dropped before it reaches the server, and the state clears shortly after the last frame. The same signal raises the playerVoiceStart and playerVoiceStop events.
     * @param player Player to query.
     * @returns True while the player's voice is reaching the server.
     */
    isPlayerTalking(player: Entity): boolean;
  };

  /**
   * Base handle for a live replicated network entity.
   */
  class Entity {
    /**
     * Creates a script wrapper for an existing entity with this ID; it does not spawn an entity.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Immutable network entity identifier.
     */
    readonly id: number;

    /**
     * Current virtual-world identifier.
     */
    readonly virtualWorld: number;

    /**
     * Authoritative world-space position; assignment forces replicated state.
     */
    position: Vector3;

    /**
     * Authoritative rotation; reads return a quaternion and assignments accept a quaternion or Euler angles in degrees.
     */
    rotation: Quaternion | Vector3;

    /**
     * Arbitrary key/value state carried by this entity. The server writes it and every client that can see the entity receives it; see StateBag.
     */
    readonly state: StateBag;

    /**
     * Formats this entity handle for logging and debugging.
     * @returns Text containing the network entity ID.
     */
    toString(): string;

    /**
     * Moves this entity into another virtual world.
     * @param world Virtual-world identifier used to partition replication and visibility.
     */
    setVirtualWorld(world: number): void;

    /**
     * Restricts replication of this entity to one owning connection while preserving normal range and visibility checks.
     * @param player Player-owned entity whose connection should exclusively receive this entity, or null to clear the restriction.
     */
    setVisibleTo(player: Entity | null): void;
  }

  /**
   * Arbitrary key/value state attached to one replicated entity, reached as `entity.state`. Keys set on the server replicate to every client that can currently see the entity.
   */
  class StateBag {
    /**
     * Reads one key from this entity's state.
     * @param key Key to read.
     * @returns The stored value, or undefined when the key is not set.
     */
    get(key: string): any;

    /**
     * Checks whether this entity's state holds a key.
     * @param key Key to test.
     * @returns True when the key is set.
     */
    has(key: string): boolean;

    /**
     * Lists the keys this entity's state holds, sorted.
     * @returns Every key currently set, in ascending order.
     */
    keys(): string[];

    /**
     * Copies this entity's whole state into a plain object.
     * @returns Every key and value currently set. The copy does not track later changes.
     */
    toObject(): Record<string, any>;

    /**
     * Watches this entity's state. The filter is applied before the handler runs, so a listener watching one key of one entity is not woken by unrelated changes. The subscription is dropped when the registering resource stops.
     * @param key Only report this key, or null to report every key of this entity.
     * @param handler Called as (key: string, value: any, previous: any) with the changed key, its new value and the value before it. `value` is undefined when the key was removed and `previous` is undefined when it held nothing.
     * @returns A zero-argument function that cancels this subscription.
     */
    onChange(key: string | null, handler: Function): Function;

    /**
     * Writes one key of this entity's state and replicates it to whoever the scope names. Throws when a limit is reached.
     * @param key Key to write; at most 64 UTF-8 bytes.
     * @param value Value to store. Booleans, numbers and strings travel as themselves; anything else is serialized as JSON. At most 4096 bytes.
     * @param options Who the key reaches: every client that can see the entity (the default), only its owning client, or nobody -- server-side storage that never goes on the wire.
     * @returns True when the value changed, false when it was already stored.
     */
    set(key: string, value: any, options?: { scope?: 'broadcast' | 'owner' | 'server' }): boolean;

    /**
     * Removes one key from this entity's state, telling every client that held it.
     * @param key Key to drop.
     * @returns True when the key was set and has been removed.
     */
    remove(key: string): boolean;
  }

  /**
   * Framework-owned base handle for a connected player, extended by each game or mod.
   */
  class BasePlayer {
    /**
     * Creates a wrapper for an existing connected player with this ID; it does not connect or spawn a player.
     * @param id Network entity identifier.
     */
    constructor(id: number);

    /**
     * Authenticated Steam identifier, or an empty string when unavailable.
     */
    readonly steamId: string;

    /**
     * Authenticated Discord identifier, or an empty string when unavailable.
     */
    readonly discordId: string;

    /**
     * Framework hardware identifier, or an empty string when unavailable.
     */
    readonly hardwareId: string;

    /**
     * Current round-trip latency in milliseconds, or -1 when unavailable.
     */
    readonly ping: number;

    /**
     * Current remote network address, or an empty string when unavailable.
     */
    readonly ip: string;

    /**
     * Formats this player handle for logging and debugging.
     * @returns Text containing the player's network entity ID.
     */
    toString(): string;

    /**
     * Checks whether this player's nametag is shown to other players.
     * @returns True unless the nametag was hidden; false also when this game has no nametags.
     */
    isNametagVisible(): boolean;

    /**
     * Checks whether the health bar under this player's nametag is shown.
     * @returns True unless the health bar was hidden; false also when this game has no nametags.
     */
    isNametagHealthVisible(): boolean;

    /**
     * Reads this player's nametag text override.
     * @returns The override, or an empty string when the player's own name is drawn.
     */
    getNametagText(): string;

    /**
     * Reads this player's nametag color.
     * @returns Packed 0xAARRGGBB color; opaque white when untinted.
     */
    getNametagColor(): number;

    /**
     * Disconnects this player from the server.
     * @param reason Optional reason shown to the disconnected player; omitting it uses the generic kicked reason.
     */
    kick(reason?: string): void;

    /**
     * Emits a named script event to this player's client connection.
     * @param eventName Client event name.
     * @param payloadJson Optional JSON payload forwarded verbatim to the owning client.
     */
    emit(eventName: string, payloadJson?: string): void;

    /**
     * Returns this player's current remote network address.
     * @returns Address string, or an empty string when the player or peer is unavailable.
     */
    getIP(): string;

    /**
     * Shows or hides the name over this player's head for every other player. The health bar has its own switch, and each player can still hide all nametags locally.
     * @param visible True to show this player's nametag to everyone, false to hide it.
     */
    setNametagVisible(visible: boolean): void;

    /**
     * Shows or hides the health bar under this player's nametag, leaving the name itself alone.
     * @param visible True to show the health bar under this player's name, false to hide it.
     */
    setNametagHealthVisible(visible: boolean): void;

    /**
     * Overrides the text drawn on this player's nametag.
     * @param text Text to show instead of the player's name; empty or omitted restores the name.
     */
    setNametagText(text?: string): void;

    /**
     * Tints the text on this player's nametag.
     * @param color Packed 0xAARRGGBB color.
     */
    setNametagColor(color: number): void;
  }

  interface BasePlayer extends Entity {}

  /**
   * Asynchronous resource event bus. Native event names and callback payloads are inferred from {@link EventMap}.
   * Script-defined event names remain supported by the string overloads.
   */
  interface EventBus {
    on<K extends EventName>(eventName: K, handler: (...args: EventMap[K]) => unknown | Promise<unknown>): () => void;
    on(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): () => void;
    once<K extends EventName>(eventName: K, handler: (...args: EventMap[K]) => unknown | Promise<unknown>): void;
    once(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void;
    off<K extends EventName>(eventName: K, handler: (...args: EventMap[K]) => unknown | Promise<unknown>): void;
    off(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void;
    emit(eventName: string, ...args: unknown[]): Promise<void>;
    emitTo(resourceName: string, eventName: string, ...args: unknown[]): Promise<void>;
    onLocal(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void;
    emitLocal(eventName: string, ...args: unknown[]): Promise<void>;
    onClient(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): () => void;
    onceClient(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void;
    offClient(eventName: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void;
    listenerCount(eventName: string): number;
  }

  /** Framework event bus for native and resource-defined events. */
  const Events: EventBus;
}

export {};
