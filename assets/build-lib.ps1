Add-Type -AssemblyName System.IO.Compression.FileSystem
# Both paths from where this script lives, so the repository can sit in any
# folder. They were written out as C:\Dev\Hades 2 until the folder was renamed.
$repo = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $repo "hades.fandom.com"
$dest = Join-Path $repo "assets"

# Categories sourced from the game files via deppth2, NOT from the wiki zips.
# This script must never delete them. See README "Refetching".
$keep = @('arcana','rarity','vows','hexes')

# The wiki half is every .webp. Game art is .png, including the icons
# scripts/assets.ts --fill copies into boons/ and duos/, and it has to survive
# a wiki rebuild. Deleting whole directories here would have taken it with them.
if (Test-Path $dest) {
  Get-ChildItem $dest -Directory | Where-Object { $keep -notcontains $_.Name } | ForEach-Object {
    Get-ChildItem $_.FullName -File -Filter *.webp | Remove-Item -Force
  }
  Get-ChildItem $dest -File | Where-Object { $_.Extension -eq '.webp' } | Remove-Item -Force
}

$gods = @('aphrodite','apollo','ares','artemis','athena','chaos','demeter','dionysus',
          'hephaestus','hera','hermes','hestia','poseidon','zeus','selene','hades')
# wiki site furniture, not game art
$chrome = '^(button|content-border|codexupdate|site-|wiki-|favicon|calling-card|search|footer|header)'
# The Black Coat page carries the game's own aspect icons as Coat_<name>.webp.
# They used to land in hammers/, which is the wrong shelf, and they are now in
# aspects/ at full resolution from GUI.pkg. Skip the wiki copies.
$chrome = $chrome + '|^coat-(melinoe|nyx|selene|shiva)$'
$wmap = @{ 'Staff'='staff'; 'Dagger'='blades'; 'Torch'='flames'; 'Axe'='axe'; 'Skull'='skull'; 'Coat'='coat' }
$weaponPage = @{ 'Witch'='staff'; 'Sister Blades'='blades'; 'Umbral Flames'='flames';
                 'Moonstone Axe'='axe'; 'Argent Skull'='skull'; 'Black Coat'='coat' }

function Get-Slug($n) {
  $s = [IO.Path]::GetFileNameWithoutExtension($n)
  $s = $s -replace '-3F','e' -replace '%C3%AB','e' -replace '_II$',''
  $s = $s -replace '[_\s]+','-' -replace "['’\.]",'' -replace '%27','' -replace '[^A-Za-z0-9\-]','-'
  $s = $s -replace '-+','-' -replace '^-','' -replace '-$',''
  return $s.ToLower()
}

$rows = @()
Get-ChildItem "$src\*.zip" | ForEach-Object {
  $zipName = $_.Name
  $wp = $null; foreach ($k in $weaponPage.Keys) { if ($zipName -match [regex]::Escape($k)) { $wp = $weaponPage[$k] } }
  $z = [System.IO.Compression.ZipFile]::OpenRead($_.FullName)
  foreach ($e in $z.Entries) {
    if ($e.Length -le 0 -or $e.Name -notmatch '\.(webp|png|jpg|jpeg|gif)$') { continue }
    $ms = New-Object System.IO.MemoryStream; $e.Open().CopyTo($ms)
    $bytes = $ms.ToArray(); $ms.Dispose()
    $base = [IO.Path]::GetFileNameWithoutExtension($e.Name)
    $slug = Get-Slug $e.Name
    if ($slug -match $chrome) { continue }

    $cat = $null; $verify = $false
    if     ($base -match '^FP_(.+)$')            { $who = Get-Slug $Matches[1]
                                                   $cat = $(if ($gods -contains $who) {'gods'} else {'characters'}); $slug = $who }
    elseif ($base -match '^Weapon_([A-Za-z]+)(\d+)') { $cat='aspects'; $slug = "$($wmap[$Matches[1]])-$($Matches[2])" }
    elseif ($base -match 'Aspect_of_')           { $cat='aspects'
                                                   $slug = $slug -replace '^xinth-','coat-' -replace '^aspect-of-','' 
                                                   if ($slug -notmatch '^(staff|blades|flames|axe|skull|coat)-') { $slug = "aspect-$slug" } }
    elseif ($base -match '^(Daedalus_Hammer|Experimental_Hammer)') { $cat='ui' }
    elseif ($base -match '^Hammer')              { $cat='hammers' }
    elseif ($base -match '^Biome_')              { $cat='biomes'; $slug = $slug -replace '^biome-','' }
    elseif ($base -match '^Element')             { $cat='elements'; $slug = $slug -replace '^element-','' }
    elseif ($base -match '^SlotIcon_')           { $cat='slots'; $slug = $slug -replace '^sloticon-','' }
    elseif ($base -match '^Card\d+$')            { $cat='arcana' }
    elseif ($base -match '^Icon-')               { $cat='ui' }
    elseif ($zipName -match 'Duo Boons')         { $cat='duos' }
    elseif ($zipName -match 'Keepsakes')         { $cat='keepsakes' }
    elseif ($zipName -match 'Boons-Hades')       { $cat='boons' }
    elseif ($zipName -match 'Characters')        { $cat='characters' }
    elseif ($zipName -match 'Infusion|Artifacts|Armor') { $cat='ui' }
    elseif ($wp)                                 { $cat='hammers'; $verify=$true }   # weapon-page upgrade icons
    else                                         { $cat='unsorted' }

    $rows += [pscustomobject]@{ slug=$slug; cat=$cat; bytes=$e.Length; data=,$bytes;
                                src=$e.Name; page=($zipName -replace ' - Hades Wiki.*',''); verify=$verify; weapon=$wp }
  }
  $z.Dispose()
}

# one file per category+slug: keep the largest (highest resolution) variant
$final = @()
foreach ($g in ($rows | Group-Object { "$($_.cat)/$($_.slug)" })) {
  $best = $g.Group | Sort-Object bytes -Descending | Select-Object -First 1
  $final += $best
}

$out = @()
foreach ($r in ($final | Sort-Object cat, slug)) {
  $dir = Join-Path $dest $r.cat
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $path = Join-Path $dir "$($r.slug).webp"
  [IO.File]::WriteAllBytes($path, $r.data[0])
  $sha = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower()
  $rec = [ordered]@{ id=$r.slug; category=$r.cat; file="$($r.cat)/$($r.slug).webp"; bytes=$r.bytes; sha256=$sha
                     sourceFile=$r.src; sourcePage=$r.page }
  if ($r.weapon) { $rec.weapon = $r.weapon }
  if ($r.verify) { $rec.needsVerification = $true }
  $out += [pscustomobject]$rec
}

# The manifest is NOT written here any more. scripts/assets.ts walks the real
# assets/ directory, which is the only way it can describe a library that holds
# game art this script never sees. Run it after this:
#
#   npm run assets
#
Write-Output "=== $($out.Count) unique assets ==="
$out | Group-Object category | Sort-Object Count -Descending | ForEach-Object { Write-Output ("{0,4}  {1}" -f $_.Count, $_.Name) }
Write-Output ""
Write-Output "needsVerification: $(($out | Where-Object {$_.needsVerification}).Count)"
