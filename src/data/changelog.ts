/**
 * What changed, for the person using it.
 *
 * Not the commit log. That has sixty-odd entries and most of them are about
 * extractors and CSS. Entries here are grouped by the day the work landed and
 * describe what is different on screen.
 *
 * Newest first.
 */

export type Release = {
  /** ISO date, so the page can format it however it likes */
  date: string
  title: string
  /** one line, what this batch covered */
  say: string
  points: string[]
}

export const CHANGELOG: Release[] = [
  {
    date: '2026-10-02',
    title: 'A plain interface, as a switch in Settings',
    say: 'The same tool with its buttons and panels drawn by the browser rather than taken from the game.',
    points: [
      'Settings has a new switch, Plain interface. Every button, menu row, tab, panel, tray, tooltip and divider is redrawn in CSS, and so are the plates behind a boon’s name, the highlight on an Arcana card, the circle behind a ring of choices and the ring round each bubble. The game’s own art stays the default.',
      'Boon and god icons, the frames that say a boon’s rarity, portraits, Charon, Dora and the wallpapers are the same either way. They are the content, not the furniture.',
      'Plain follows your theme all the way: Olympian’s edges are gold and Infernal’s copper, where the game’s art could only be tinted. A boon’s plate carries its rarity as a stripe in the colour the game gives it.',
      'Nothing moves when you flip it. Every button is the size it was.',
      'An empty caption under a ring of choices no longer draws its frame. It was meant to go when the caption was blank, and never did.',
    ],
  },
  {
    date: '2026-09-18',
    title: 'Guides, and a build named in one says how your run stands with it',
    say: 'The other half of the feature the last batch laid the ground for.',
    points: [
      'Guides is a screen now, in the row the build exchange used to have. Yours on one side, everybody’s on the other, same switch as Builds.',
      'A guide is a title and a few sections of writing with builds named inside it. Four prompts to start you off, none of which you have to answer, and four more sections with headings of your own. The ones you leave blank are skipped when anybody reads it.',
      '**Read a guide during a run and every build it names says how that run stands with it**, the same reading the run screen gives your own builds. So the same paragraph says something different at the fourth Exit than it did at the Crossroads. Guides open from the menu mid run, like everything else.',
      'A build whose author has changed its picks since the guide was written says so, and one they have taken off the shelves says withdrawn. A guide hands over every build it names in one go, so a long one costs one request rather than one per name.',
      'What a guide card says it is about is counted out of the writing itself. Nobody types tags, and there is nothing to go stale.',
      'Save a guide and it is on your side. Like one, if you want, which is a separate number. Neither of them says who, and neither takes your own guide. There is a way to report one, which goes to a person rather than to a counter.',
      'A guide you are part way through stays in this browser until you publish it, so a stray reload costs nothing. Writing one does not need an account; publishing one does, which is what gives it an address.',
      'Charon stands on everybody’s side of Guides as he does on Builds, and Schelemeus on yours.',
    ],
  },
  {
    date: '2026-09-17',
    title: 'Builds is one screen, and a build named in a note says how your run stands with it',
    say: 'The first half of guides, and two figures to go with Charon.',
    points: [
      'The build manager and the exchange are one screen now, called Builds, with a switch at the top: yours on one side, everybody’s on the other. The side you left it on is the side it opens on, and whatever you had filtered or opened on the other side is still there when you come back.',
      'Mine and Followed are gone from the exchange, because both kinds of build were in your library already. Their counts are on your own cards instead, and a card says when its listing is off the shelves.',
      'A build you published and then deleted used to be findable only on the Mine shelf. Your side now says when a listing of yours has no build behind it, and puts the published version back in your library in one press.',
      'Type @ in a build’s write-up to name a build you published or follow, or paste a build’s short link. While a run is being logged, the name carries how that run stands with the build: “Killer Current (needs 4 more picks, with 40 Exits left)”. A build that is gone says withdrawn, and one that simply could not be reached just shows its name.',
      'Schelemeus stands on your side of Builds and Odysseus stands on the Wiki, both out of the game’s own portraits, and both blink now and then. Like Charon, neither is drawn, or downloaded, on a screen too narrow to fit him.',
      'Phones no longer download Charon or Dora, who were hidden on small screens but fetched anyway.',
    ],
  },
  {
    date: '2026-09-12',
    title: 'Help is half the length and twice as current, and the menu says what is coming',
    say: 'The help page had stopped keeping up, and three things on the roadmap had nowhere to go.',
    points: [
      'Help was written for the run screen and the exchange and never caught up: nothing in it mentioned the wiki, the lines under a boon, the four keepsakes a build can name, the notes on its picks, or what the game means by damage from Olympians. All of that is in it now, and it is about half as many words as before.',
      'It shows things rather than describing them where it can. The five slots wear the game’s own glyphs, the rarity ladder is the real one drawing Heaven Strike’s real numbers, and the example mention is a real mention. Nothing in it is a screenshot, so an example that goes out of date shows it instead of quietly lying.',
      'Builds by aspect, Play history and Suggested builds are in the menu now. None of them is built, and each one opens on Dora saying so and what it is waiting for. A menu that only lists what exists hides the shape of the thing.',
      'The roadmap has caught up with the last two days, including what is left: the eleven numbers that still read #, and Collections, which is waiting on one decision rather than on any code.',
    ],
  },
  {
    date: '2026-09-12',
    title: 'Show me the ones somebody else has actually finished',
    say: 'One filter on the exchange, over a count rather than a badge.',
    points: [
      'The filter bar on the exchange has Cleared by somebody else. It carries the number of builds it would leave, so pressing it is never a surprise.',
      'One clear means one other player: your own runs have never counted toward your own listing, and the counts are kept per version, so an author who changes the picks starts again rather than keeping evidence earned by a different build.',
      'It is not a tier and there is no badge. Nobody grants it, nobody can be asked for it, and it is never called Verified. It is a count, and the button says which count.',
      'Turn it on when nothing qualifies and the shelf says so, because early on that is the true answer rather than a mistake in your filters.',
    ],
  },
  {
    date: '2026-09-12',
    title: 'Under the hood is back, and one of it was wrong',
    say: 'Rules the game never tells you, sorted by how likely you were to find them yourself.',
    points: [
      'It is a screen in the menu now, beside the Wiki. It used to be on the page that stood in front of the app, and it left when that page did in early September.',
      'Three tiers, and nothing opens unless you open it: things no number of runs would surface, things you might get to eventually, and things you will work out yourself and are better off working out yourself.',
      'One entry was wrong for the whole time it was live. It said that taking a fourth Olympian made every other god impossible for the rest of the run. The cap is on the random pool: a keepsake overwrites that choice outright, and all nine Olympians have one, so a fifth god is a keepsake away. The corrected entry says so and names the line.',
      'Every entry names the code it was read from, and the two that are our opinion about how to play rather than a rule in the files are marked as ours.',
    ],
  },
  {
    date: '2026-09-12',
    title: 'What counts as Olympian damage, and what does not',
    say: 'Three things in the game multiply damage from Olympians, and the game means a list of names rather than a set of gods.',
    points: [
      'Extended Family, the Earth infusion Rallying Cry and Argent Skull’s Aspect of Persephone all read the same two lists in the game’s files: 63 projectiles and 3 effects. A build holding one of them now gets a line saying which of its picks are on that list, or that none of them are.',
      'Every boon, Hex and aspect whose damage is on the list says so in its wiki record, and names the projectile or effect it comes out of, so the claim can be checked against the game.',
      'The list is not the four Olympian cap. It includes Artemis and Athena projectiles, and neither of them ever spends an Olympian slot, so which gods you hold does not answer it.',
      'It is read out of each pick’s own record, so it can miss one: a pick it does not name may still count. It never claims the other way round, and it never says your damage does not count.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'A line on each pick, and names that lead somewhere',
    say: 'Say why a pick is in a build, next to the pick, and name a boon in your write-up so it opens its record.',
    points: [
      'The Notes tab has a line for each pick in the build: why it is there, what it feeds, what to take instead. A note shows when somebody points at that pick or opens it, and all of a build’s notes are listed under How it works.',
      'When a run is going for a build, the note on a boon is on its card at the Exit, marked as the author’s, so the reason is there at the moment you choose. A card with a note says so beside its name.',
      'Starting a run can go for your own builds and the ones you follow. The step only ever read the builds that ship with the tool, and none do yet, so it said nothing was on your aspect whatever you had written.',
      'Type @ in How it works, If the run goes your way or a note, and a list offers what you might mean, the build’s own picks first. What goes in is drawn as the thing itself, with its art, its hover and a link to its record in the wiki.',
      'A build’s notes share 500 characters, so the whole build still fits in one link short enough to paste into Discord.',
      'Rewording a note is not changing the build. Runs keep counting toward a build you follow, and its author’s new notes reach you without asking.',
      'Pointing at something near the bottom of the screen no longer puts the end of its description below the edge.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'A wiki, read out of the game',
    say: 'Everything the tool knows, a record each, and an index of them all.',
    points: [
      'The menu has a Wiki. Every boon, Hex, keepsake, aspect, Daedalus Hammer, Arcana card and familiar the tool knows is in it, 597 in all, filed where you would look: by god, duos and legendaries, Hexes and the Path of Stars, each arm’s aspects and hammers, and what Circe, Echo, Icarus, Medea and Narcissus offer along the way.',
      'Each one has a record at its own address, so sending somebody the link opens it. A record gives the game’s own description and the numbers under it, then what the game never tells you: what a duo needs, which duos and legendaries a boon counts toward, how much of an element it takes, whether a Pom can raise it, and which of your builds use it.',
      'All of it comes out of the game’s files and is read again after a patch. Nothing in it is written by hand.',
      'Opening any piece of a build now has a link to its full record.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'A build carries all four keepsakes',
    say: 'A run gives you four keepsakes and a build could only name one.',
    points: [
      'You choose one keepsake at the Crossroads, and once Kindred Keepsakes is cast you can swap at the rack after each of the first three Guardians. A build can name all four now. The Before you go tab has a picker for each rack, and each one keeps what you are carrying until you change it.',
      'A build that swaps shows its keepsakes in order, each saying when it is taken. A build that does not swap looks exactly as it did.',
      'Filtering by a keepsake finds the builds that swap to it as well as the ones that start with it.',
      'Builds already on the exchange keep their runs and ratings. Adding a swap to one counts as changing its picks, the same as changing a boon, because the keepsake you carry into a Region is part of what you played.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'A boon says how much, not only what',
    say: 'The lines the game draws under a boon, which the tool had never shown, and most of the holes in its sentences filled.',
    points: [
      'Pointing at a boon, or opening one, now shows the lines the game prints under its description: Heaven Strike’s Blitz damage, Storm Ring’s bolt damage, Extended Family’s bonus for each god. 275 things in the tool carry at least one, and until today not one of them was shown.',
      'A build does not know what rarity you will find a boon at, so where the number changes with rarity you get all four, each marked in the game’s own colour for Common, Rare, Epic and Heroic. Opening the boon names each one.',
      'The element a boon carries is now on the line with its slot and its gods, with the game’s own mark for it.',
      'Numbers are read at the rarity the game’s own Codex shows. That is why Heaven Strike’s Blitz reads 80 at Common rather than the 100 underneath it.',
      'Sentences that showed # where a number belonged now mostly have the number: 193 holes are down to 27. What is left needs something only a run in progress knows, or a table the tool does not read yet, and stays a # rather than a guess.',
      'Chaos boons roll their numbers, so their sentences now give the range they can land in, smallest first.',
      'Three of Narcissus’s gifts used to promise +1 health or +1 Magick. That was the number of drops, not what they are worth, so they show # until the tool reads what a drop restores. Giga Moonburst’s Magick cost shows # for a similar reason: the game subtracts one charge stage from another, and the tool does not read that weapon’s stages yet.',
    ],
  },
  {
    date: '2026-09-11',
    title: 'Coming back to the tab no longer loses what you had open',
    say: 'A background sync was throwing away the build you were reading and the edit you had not saved.',
    points: [
      'Whenever your builds changed underneath the screen, because another device had synced something, a build you follow had moved, or you had kept a shared link, the whole build screen was rebuilt from scratch. That threw away whatever you had open: the build you were reading, the run you were logging, your filters, and an edit you had not saved yet.',
      'A sync runs every time you come back to the tab, and this is a tool you switch away from to play. So switching back from the game was enough to lose a build halfway through writing it.',
      'The screen now reads your builds again when they change and leaves everything you have open alone. A build that was deleted on another device still closes, because there is nothing left to show.',
      'News about a build you follow, that its author changed the picks or took it off the exchange, now shows up even when that build was already open as the news arrived.',
    ],
  },
  {
    date: '2026-09-10',
    title: 'A build says what it is built around, and which keepsake would help',
    say: 'Two things a build has always carried and never explained, plus the author’s write-up where a reader can actually reach it.',
    points: [
      'A build records what it is built around, and the tool had never once said what that meant. “Ω Special” was a label you could filter a shelf by with nothing behind it anywhere. Every one of the nine now carries a sentence saying what the move is, taken from the game’s own glossary.',
      'A build with no keepsake chosen is now told which ones would help. It knows which gods its boons come from, and each of the nine has a keepsake that makes their next offer likely, so it lists them. It never picks one for you, and it says nothing at all once you have chosen.',
      'Reading somebody else’s listing on the exchange showed the picture of the build and not a word of what the author wrote about it, which is the thing you open a stranger’s build for. Their write-up is in there now.',
      'A build with no write-up used to show the heading “How it works” above an empty space. Now it shows nothing.',
    ],
  },
  {
    date: '2026-09-08',
    title: 'Two shelves that were missing, leaderboards, and a count that was never counting',
    say: 'Your own published builds were on no shelf at all, and most listings had been quietly dropping every run logged against them.',
    points: [
      'Every run logged against a build published and never replaced was being thrown away. The browser sends which version it is holding so a run cannot be counted toward a build somebody has since rewritten, and publishing was not sending that version in the first place, so the two never matched. Runs, clears and best Fear sat at zero on those listings, which is exactly what a build nobody has played looks like, and rating one was refused as unplayed even after you had played it. Fixed both ends: new listings say which version they are, and a listing that never said gets the benefit of the doubt rather than losing your run.',
      'The exchange had two shelves and neither could contain your own builds, so publishing nine and seeing one was working as designed. There are four now: All, From friends, Mine, and Followed.',
      'All is every build anybody has published and not taken back down. It was held back on the grounds that a shelf of everybody needs a way to report a listing and a way to hide one first, and it is open now without them. A listing carries a build’s name and its author’s name and nothing else anybody wrote.',
      'Mine is your own listings, and it keeps the ones you have taken down, marked. That is the only place they appear, and it is the only way to reach a listing whose build is no longer in this browser. Followed is the builds you took up, and it keeps the ones their authors withdrew, because those go on working for you.',
      'The shelf of builds picked by hand is gone, along with the note that went on each one. It was the default and the only shelf a stranger could see, which made sense while there was no way to browse and stopped making sense the moment there was. You find what you want yourself now.',
      'Leaderboards. What has been followed, played and cleared most, at what Fear, and by whom, for everybody or just the people whose codes you swapped. Also which arm, aspect and god get published most, and a few sillier ones.',
      'Every board counts one thing and none of them is a rate. A clear rate would rank five clears from five runs above ninety from a hundred, which says more about how much evidence there is than about the builds.',
      'The shelf buttons were sitting on top of the line above them. They are not now.',
    ],
  },
  {
    date: '2026-09-08',
    title: 'Two half-finished things, and a roadmap that had gone out of date',
    say: 'Found by reading yesterday’s plan back against the code rather than by anybody hitting them.',
    points: [
      'The number of people who have taken a build had been frozen since following replaced copying, because nothing was left that counted one. Following tells the exchange now, so it moves again, and it is labelled for what it counts: followed by, rather than taken.',
      'You could start following a build its author had taken off the exchange, if you had the link. Reading one is still the point of the link; starting to follow something that will never change again is not.',
      'Taking a listing down had no way back. Put it back existed and nothing could reach it, and the menu offered Take it down for a build already off the shelves, because this side had no idea which state it was in. It knows now, including when the takedown happened on another device.',
      'This page said the exchange still worked the old way: take a copy and it is yours. It has said following for two days. It also said nothing about what following protects you from, or about being able to update and take down what you published, so there was no way to learn either existed.',
      'And a check now holds this page to the code. Every entry names a file: a built thing’s has to exist and a planned one’s has to not, so something shipping without its entry moving fails the build. That is how this went out of date twice.',
    ],
  },
  {
    date: '2026-09-07',
    title: 'Nobody else can rewrite a build in your library',
    say: 'What following means when the person you follow changes their mind.',
    points: [
      'You could follow your own build, which put a second copy of it in your library marked as somebody else’s. Your own listings say so now and offer no Follow button, and following one through a raw link is refused as well.',
      'When somebody changes a build you follow, what reaches you depends on what they changed. A better note or a clearer name simply arrives. A change to the picks is a different build, so it waits: you are told, and you choose between their version and the one you have. It used to overwrite yours without asking.',
      'Taking a build down no longer destroys it. It leaves the shelves so nobody new finds it, and everything else stays: the link still opens for anybody who has it, it stays in the library of everybody following it, and every run and rating people logged against it survives. It used to delete all of that.',
      'If an author replaces a build with a substantially different one, the listing’s counts start again, and what the old version earned stays visible as being from before the change. Four stars from forty people is a claim about the build those forty played.',
      'And the author is warned before that happens, with the gentler option offered first: publish it as a second build instead of replacing the one people are following.',
      'Authors can now update or take down what they published, from the build itself. The server had told anybody with fifty published builds to “unpublish one first” since publishing existed, with no way to do it.',
    ],
  },
  {
    date: '2026-09-07',
    title: 'Escape closes things, and the coins are the right size',
    say: 'Two the owner caught by using it.',
    points: [
      'Escape closes what is on top, and so does clicking the dim outside it. The listing on the exchange, a boon’s card, a build somebody shared with you and the run log all opened over the page with no way out but the mouse. On the run log it means Back while you are naming vows and Close on the form, because leaving from in there would throw away the answer you were part way through giving. An Escape that a menu has already answered is left alone, so one keystroke never closes two things. Clicking outside answers the same way, and a drag that starts inside does not count, so selecting a paragraph and releasing past the edge keeps what you selected.',
      'The coins Charon is holding were drawn a quarter too small and about ten pixels out of place, because their size is stated on the record they inherit from rather than on the record itself and I read only the record. They are the right size now, and the swirl underneath was measured rather than blamed: the cluster drifts about five pixels and comes back, which is five per cent of its own width, over two seconds. That is the game’s own animation at the game’s own speed, and it stays that way.',
      'The sprite sheet behind them was rebuilt too. It had been built by fitting each of the sixty frames to its cell instead of cropping all sixty to one box, so every frame sat somewhere slightly different and 41 of them were clipped at the edge. Rebuilt from one box: the wander is down from 8.9 pixels to 4.1, which is what the animation actually does, and nothing is cut off.',
      'He also failed to appear at all sometimes. The portrait was marked as deferrable, and it is positioned by its own width, so before it loaded it sat exactly off the right edge of the window, where the browser decided it was not worth loading. It is not deferred now.',
    ],
  },
  {
    date: '2026-09-07',
    title: 'A shelf that can hold hundreds, and Charon out of the way of it',
    say: 'The exchange showed one very large card at a time. It shows a list now, and the list is the point.',
    points: [
      'The exchange is as wide as the build manager. It was not: it was drawing the build manager’s grid inside a reading page capped at a paragraph’s width, Charon was standing on a third of what was left, and the grid resolved to a single column. One very large card. The cards were never the problem.',
      'Cards or a list, and the control is next to Sort on both shelves. A list is a row each: the aspect, the name, the arm and the reading, with the byline, the counts and Follow beside it. Everything else is one click away in the listing.',
      'Nobody has to choose. Your own builds open as cards, because a library is a handful of things and the plate earns the space. The exchange opens as a list once there is more than a screenful, because it is expected to hold hundreds. Press the control once and it remembers your answer everywhere.',
      'Measured rather than eyeballed. At 1600 by 950 the exchange showed five of eighteen builds as cards, at 2.38 screens of scroll. It shows twelve now, fourteen at 1920 by 1080, and every row is the same height whether the build has a one-word name or four figures of play behind it.',
      'Charon is smaller and further right, and the shelf has a clear column beside him. Zero overlaps between his drawn box and any row, at 1280, 1600 and 1920, with the menu pinned and not.',
      'The coins in his hand are actually there. They were animating through sixty frames of which fifty-nine were painted off the edge of the sprite sheet, so they appeared for one frame in sixty and were invisible in any screenshot. Sixty frames, all of them on screen.',
    ],
  },
  {
    date: '2026-09-06',
    title: 'You follow a build now, rather than copying it',
    say: 'A build you take off the exchange stays its author\u2019s, and their edits reach you.',
    points: [
      'Clicking a card on the exchange used to take a copy. Every click. There was no way to read a listing without duplicating it, no confirmation and nothing to undo, so it was possible to end up with copies of copies. Opening a card reads it now, and following is a button you press on purpose.',
      'Following is not copying. The build stays the author\u2019s, it sits in your library marked as theirs, and when they improve it the new version reaches you. Following the same build twice is following it once.',
      'Changing one is what makes it yours. A followed build has no Edit; it has \u201cMake it mine\u201d, which takes it on as an ordinary build of yours and ends the following. Runs you have logged still count toward the build it came from until you change a pick.',
      'A new filter, Whose, so \u201conly mine\u201d is one click. It appears once there is actually something of somebody else\u2019s to tell apart.',
      'You could take, play and rate your own published build, and all three moved its public numbers. None of that was checked. It is now: your own take is refused because the build is already yours, your own runs are recorded in your library and counted nowhere else, and you cannot rate your own build.',
      'Publishing the same build twice made two listings. There is a proper replace now, so editing and republishing updates the one people are following instead of orphaning them on the old one.',
      'Charon runs the exchange. He stands at the foot of the shelf, out of the game\u2019s own portrait art, and the counts wear his coins. The exchange looked exactly like the build manager before, which is a poor way to tell you that none of this is yours.',
    ],
  },
  {
    date: '2026-09-06',
    title: 'Which vows a run took, and four pages that had stopped fitting',
    say: 'A Fear number can say what it was earned under, and the reading screens stop asking you to scroll past them.',
    points: [
      'Logging a cleared run can now record which vows were on and how far up each one was taken. “Name the vows” opens the Oath of the Unseen as its own screen, with all seventeen and their real icons, and Back returns to the form. Most runs will not need it: a number on its own is still a perfectly good answer.',
      'The sheet never overwrites the number you typed. Ticking three of the five vows you actually ran is the normal way to fill this in, and if it won, a Fear 30 run would quietly become a Fear 9 one. The total stands, the sheet says what it comes to, and where they disagree the screen says so and leaves it alone.',
      'The vows show up under a build’s runs and clears, so “cleared Fear 20” can say whether that was under Vow of Pain or Vow of Void. Those are very different runs and the number alone cannot tell them apart.',
      'Every vow has its real icon from the game now. They had looked missing for months because they are filed under the sprite’s name rather than the vow’s: Vow of Pain draws the one called Blood, and the mapping was one step further into the game files than anybody had looked.',
      'Roadmap is a timeline across the page instead of a list down it, Help reads in two columns, Settings opens with what it is holding, and the Changelog you are reading now opens on the newest batch with the rest a click away. It was five and a half screens of scrolling.',
      'The Roadmap also had two features filed under “not started” that have been live for days: the build exchange, and your builds following you between devices.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'The build exchange, and what happens after you take one',
    say: 'Two shelves of other people’s builds, and runs that count toward the build they came from.',
    points: [
      'Two shelves: builds picked by hand, and builds from people you swapped codes with. There is no shelf of everything anybody published yet, because that needs a way to report and hide a listing first.',
      'Take a copy and it is an ordinary build of yours: your name on it, and none of somebody else’s runs.',
      'A run you log against a copy is counted toward the build it came from, which is where “1 of 1 cleared” on a listing comes from. It stops the moment you change the build, because it is your build then rather than theirs.',
      'Rating a build needs a run behind it, so a rating is always somebody saying how it went rather than how it read. The number of raters is always shown beside the average, because two people saying four is a different thing from two hundred.',
      'Logging a run now asks how dependably the build came together, and keeps the answer. It used to ask and throw it away.',
      'A switch in Settings turns the counting off. Everything else keeps working: you can still take builds, still log runs, still read the counts.',
      'Nothing else about you is counted anywhere. No analytics, nothing about what you look at or how long for.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'Accounts, short links, and your things on both devices',
    say: 'You can sign in now. It buys two things, and the tool still works entirely without it.',
    points: [
      'Sign in, and a build you publish gets a link about thirty characters long instead of the 1,588 character one that carries the whole build inside it. Discord renders the long one as a wall.',
      'Viewing, building, checking and saving are all still free and none of them asks who you are. An account is what gets you the rest.',
      'Your builds, your runs and your settings follow you between devices. Sign in on a phone and what you made on a desktop is already there. Where two devices disagree about the same build, the one changed most recently wins.',
      'It copies rather than moves. Everything still lives in this browser, everything still works signed out, and Settings still has the export.',
      'Friends, by swapping an eight character code. You see what they publish, they see what you publish, and nobody else sees either.',
      'There is no way to search for a person, which is deliberate: it means nobody can be found who did not want to be.',
      'Forgotten your password now sends a letter that actually arrives, from Dora, who has read it and has notes.',
      'Resetting signs out every other session, because people reset a password when they think somebody else has it.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'The About page is gone',
    say: 'It was saying what the front page already said.',
    points: [
      'Where the numbers come from moved into Help, at the top, because knowing the rules were read out of the game’s own files is the reason to trust the definitions underneath them.',
      'The menu had both About and What this is. It has one entry now, called About, and it opens the page a first visit opens on.',
      'The claim that nothing ever leaves your browser is gone from the few places it was still written. It was true, and publishing is the point at which it stops being.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Dora',
    say: 'None of this makes the tool better. It is going in anyway.',
    points: [
      'The sections that are not built yet used to be greyed out and unclickable. They open now, onto an empty page with Dora standing in it holding a clipboard. The phase marker is still there, so nothing is pretending.',
      'Dora has opinions about being clicked. She has eight of them and they escalate.',
      'On the fifth click she attempts a frightening voice. It does not hold.',
      'She also stands on the roadmap and watches it scroll past, which she is not being paid for.',
      'Her lines were written by reading the 763 she has in the game and copying none of them.',
      'This entry exists so that the changelog, which is a document about work, contains a note about the work of adding a ghost who does no work.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'The build editor, rebuilt',
    say: 'Most of the first round of playtest feedback, and the editor took the bulk of it.',
    points: [
      'Boons are sorted into two trays instead of picked from two lists. A boon is either in the build or worth adding, and it can no longer be in both at once.',
      'Drag a boon into a tray, or click it to send it into the build. Rows are larger and the game’s own plates sit behind them.',
      'The picker greys out anything a run could not give you, and says why on the row.',
      'A missing prerequisite now lists the boons that would satisfy it, says which of them would replace something you already hold, and adds the one you pick.',
      'Warnings jump to the control they are about rather than to the nearest tab, and put the cursor in it.',
      'The worst thing about a build is always visible in the left pane, whichever tab you are on.',
      'Hammer upgrades locked to one aspect no longer appear on the others, in the editor and in the run.',
      'The Arcana tab now refuses a board a save could not hold, matching the Arcana screen.',
      'Delete asks first.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Logging runs, and a bin',
    say: 'Recording how a build went, and getting one back after deleting it.',
    points: [
      'Log run, on an open build. Four answers: cleared or not, whether the build came together, the Fear, and where it ended. It says what it will record before it records it.',
      'Fear is only kept on a clear, and only when it beats what is already there.',
      'Deleting a build moves it to a bin rather than removing it. Put one back, remove one for good, or empty the bin.',
      'The bin travels with an export, so a restored browser still has its undo.',
      'Runs and clears use the game’s own steppers, the way Fear already did.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'Reading a build',
    say: 'What the screens show, and what they show it on.',
    points: [
      'Hovering anything says what it is: boons on the game’s boon plate, keepsakes, familiars, Hexes and Arcana on its tooltip backing.',
      'The five core slots wear the game’s primary frame.',
      'Worth adding is drawn on both detail layouts, with the Olympians it would cost.',
      'The Constellation shows the build’s name.',
      'Copy the card puts a picture of the build on your clipboard, to paste beside the link. A link on its own cannot carry a preview without a server.',
      'A build can say what it leans on: Attack, Ω Attack, Cast and the rest.',
      'The Arcana card preview fills the middle of the screen instead of a thin strip.',
      'The roadmap counts how much of itself is built.',
      'Wallpapers renamed: Retribution, Hermes, Olympos, Hades chained, Pact of Punishment, Stygian Blade, The Cauldron.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'An empty library, and a longer run',
    say: 'Two corrections, one of them to a number a lot of the tool reads.',
    points: [
      'The library ships empty. The placeholder builds are gone: a placeholder in a library reads as a recommendation.',
      'A run is about forty Exits, not twelve. Four Regions of eight to twelve each. Everything that judges whether a build is still reachable was working against a third of a real run.',
      'A build may name a fifth Olympian. The cap of four is on the random pool, and a keepsake gets past it.',
      'Arcana on a build are a couple of suggestions rather than a whole board. Five at the outside.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Export, import and sharing',
    say: 'Ways to get your builds out of this browser and into another one.',
    points: [
      'Export everything to a file, from Settings. The button says how long it has been since the last export.',
      'Import a file. It replaces what is in the browser, and it tells you what the file holds before it writes anything.',
      'Share one build as a link, from the build’s own menu. The build is encoded in the link, so there is no server involved.',
      'A shared build does not carry the rating, runs or clears you recorded for it.',
      'Set a name in Settings. It is added to builds you make and travels with a build you share.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Themes',
    say: 'Four colour schemes, each with its own background, particles and wallpapers.',
    points: [
      'Unseen, Olympian, Infernal and Cthonic. Colours are taken from the game’s own art.',
      'Particle effects differ per theme: rising dust, falling motes, embers, and a static star field.',
      'Each theme has several wallpapers. Every one is dimmed so it does not compete with the interface.',
      'Buttons, panels and card frames shift colour with the theme.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Saved builds',
    say: 'Builds you make are now editable, forkable and removable.',
    points: [
      'Duplicate any build, including the eight samples.',
      'Delete a build from its own menu. It asks for confirmation.',
      'Record a rating, runs, clears and how reliably a build comes together. The win rate is calculated.',
      'Each build has a permanent id, so a build sent to another browser stays the same build.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Builds as the home screen',
    say: 'The app opens on your builds instead of on run setup.',
    points: [
      'The menu is available on every screen.',
      'On a desktop the menu can be pinned open as a side pane.',
      'The run header counts builds you can still complete, instead of counting duos and legendaries.',
      'You can pick a build before starting a run, and the run tracks it.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Arcana board',
    say: 'The full five by five board, in the game’s own layout.',
    points: [
      'Select the cards you pay Grasp for. The six free cards are worked out from that.',
      'Any free card that stays off explains which condition it fails.',
      'Hovering a card shows what it does.',
    ],
  },
  {
    date: '2026-08-30',
    title: 'Build manager and editor',
    say: 'A screen for browsing builds, and a form for making them.',
    points: [
      'Filter by arm, aspect, gods, keepsake and familiar. Filter options are derived from the builds themselves.',
      'A build opens as a Poster or a Constellation layout.',
      'The editor checks a build as you write it and lists anything the game would not allow.',
    ],
  },
  {
    date: '2026-08-29',
    title: 'Run companion completed',
    say: 'The remaining features for logging a run.',
    points: [
      'The offers at an Exit, ranked, with a reason to decline where there is one.',
      'A summary when you return to a run you left, showing what changed while you were away.',
      'Undo a mistaken entry without restarting the run.',
      'Keyboard and screen reader support across the run screen.',
    ],
  },
  {
    date: '2026-08-28',
    title: 'The run screen',
    say: 'Log each Exit as you take it and see what is still reachable.',
    points: [
      'Every duo and legendary evaluated against what you hold and how many Exits remain.',
      'Completion odds calculated by simulating runs, not estimated.',
      'Picks that close off a target are marked at the Exit where it happened.',
    ],
  },
  {
    date: '2026-08-27',
    title: 'Game data extraction',
    say: 'Reading the game’s own files, which everything else depends on.',
    points: [
      'All mechanics are read from the game’s shipped Lua rather than from wikis.',
      '37 duos and 10 legendaries, counted using the game’s own markers.',
      'Every boon, aspect and Arcana card matched to its art from the game packages.',
    ],
  },
]
