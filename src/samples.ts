/** Pad notes written while taking off in PlanSwift — the re-key source. */
export const SAMPLE_NOTES = `PlanSwift takeoff — Kitchen Reno — sheet A2.1
counted walls/ceil off the model, wrote these on the pad (do not re-type into Excel):

5/8 type X drywall  42 sheets @ 18.50   (walls+ceil, PS count)
mud + tape  12 buckets  14.00
2x4x12 studs x 86  4.25
R13 batts  28 bags ~32
paint labor  16 hrs @ 65
paint  8 gal @ 38
baseboard  210 LF  1.85
interior doors  6 ea @ 145
door hardware  6 sets  28
demo dumpster  1  475
misc fasteners allowance  125
hang drywall labor  24 hrs  55
cleanup crew  4 hrs (no rate written)

NOTE: add 10% waste on drywall sheets — don't transpose 42 sheets as 24, don't swap 6 doors @ 145`

/**
 * Office Excel estimate template.
 * Unit Price sits before Qty on purpose — positional paste is how qty/price get swapped.
 */
export const SAMPLE_EXCEL = `Item	Description	Unit Price	Qty	UOM	Total	Notes
1	5/8" Type X drywall (walls + ceil)	18.50	42	SHT	777.00	PS A2.1 count
2	Joint compound / tape	14.00	12	BKT	168.00	
3	2x4x12 studs	4.25	86	EA	365.50	PS count
4	R13 batt insulation	32.00	28	BAG	896.00	
5	Paint labor	65.00	16	HR	1040.00	
6	Interior paint	38.00	8	GAL	304.00	
7	Baseboard	1.85	210	LF	388.50	PS linear
8	Interior doors	145.00	6	EA	870.00	
9	Door hardware	28.00	6	SET	168.00	
10	Demo dumpster	475.00	1	LS	475.00	
11	Fasteners allowance	125.00	1	LS	125.00	
12	Hang drywall labor	55.00	24	HR	1320.00	
13	Cleanup crew		4	HR		rate missing on template
	NOTE: add 10% waste on drywall sheets — lock Qty vs Unit Price before export			
`

/**
 * Generic PlanSwift-style takeoff grid (Item / Quantity / Units / Unit Cost / Page Name).
 * Offices customize Estimating/Report columns; this is one common layout, not a plugin dump.
 */
export const SAMPLE_PLANSWIFT = `Item	Folder	Type	Quantity	Units	Unit Cost	Page Name	Notes
5/8" Type X GWB - Walls	Drywall	Count	42	EA	18.50	A2.1	wall count
5/8" Type X GWB - Ceiling	Drywall	Count	18	EA	18.50	A2.1	
Joint compound / tape	Drywall	Count	12	EA	14.00	A2.1	
2x4x12 Stud	Framing	Count	86	EA	4.25	A2.1	
R13 Batt Insulation	Insulation	Count	28	EA	32.00	A2.1	
Baseboard	Trim	Linear	210	LF	1.85	A2.1	
Interior Door	Doors	Count	6	EA	145.00	A2.1	
Door Hardware Set	Doors	Count	6	EA	28.00	A2.1	
Interior Paint	Paint	Count	8	GAL	38.00	A2.1	
Paint Labor	Labor	Count	16	HR	65.00	A2.1	
Hang Drywall Labor	Labor	Count	24	HR	55.00	A2.1	
Cleanup Crew	Labor	Count	4	HR		A2.1	no rate in takeoff
Demo Dumpster	Demo	Count	1	EA	475.00	A2.1	
Fasteners Allowance	Misc	Count	1	LS	125.00	A2.1	
NOTE: 10% waste on drywall GWB — export these rows, do not re-key into the estimate sheet
`

/**
 * Example format modeled on PlanSwift “Export by Page” (public ConstructConnect help):
 * Page, Digitizer Item, optional Item Number, takeoff value, Units, Color.
 * https://help.constructconnect.com/plugins-adding-functionality-to-planswift-54/planswift-export-by-page-plugin-1687
 * BOM + title rows + blank lines — typical of a saved report, not an official dump.
 */
export const SAMPLE_EXPORT_BY_PAGE = `\uFEFFPlanSwift Export by Page — example format
Job: Kitchen Reno   Page filter: A2.1

Page	Digitizer Item	Item Number	Value	Units	Color

A2.1 Kitchen	5/8" Type X GWB - Walls	DW-01	42	EA	RGB(210,210,210)
A2.1 Kitchen	5/8" Type X GWB - Ceiling	DW-02	18	EA	RGB(210,210,210)
A2.1 Kitchen	Joint compound / tape	DW-03	12	EA	RGB(180,180,180)
A2.1 Kitchen	2x4x12 Stud	FR-01	86	EA	RGB(160,120,80)
A2.1 Kitchen	R13 Batt Insulation	IN-01	28	EA	RGB(240,220,120)
A2.1 Kitchen	Baseboard	TR-01	210	LF	RGB(90,90,90)
A2.1 Kitchen	Interior Door	DR-01	6	EA	RGB(120,80,40)
A2.1 Kitchen	Door Hardware Set	DR-02	6	EA	RGB(80,80,80)
A2.1 Kitchen	Interior Paint	PT-01	8	GAL	RGB(250,250,250)
A2.1 Kitchen	Paint Labor	LB-01	16	HR	RGB(200,200,220)
A2.1 Kitchen	Hang Drywall Labor	LB-02	24	HR	RGB(200,200,220)
A2.1 Kitchen	Cleanup Crew	LB-03	4	HR	RGB(200,200,220)
A2.1 Kitchen	Demo Dumpster	DM-01	1	EA	RGB(40,40,40)
A2.1 Kitchen	Fasteners Allowance	MS-01	1	LS	RGB(100,100,100)
`

/**
 * Example format modeled on Estimating-tab Excel export / UDA handoff columns:
 * Item Name, Folder Path, Cost Each, Qty, Units, Price Total (Cost Each before Qty on purpose).
 * https://constructconnect-help.atlassian.net/wiki/spaces/PSUPPORT/pages/48693673/Trouble+Shooting+UDA+Construction+Suite+Integration+with+PlanSwift+9.x
 * Semicolon CSV + quoted names — another real-world save shape, not an official dump.
 */
export const SAMPLE_ESTIMATING = `PlanSwift Estimating layout — example format
Folder Path / Qty / Cost Each / Price Total (UDA-style Excel handoff)

Item Name;Folder Path;Cost Each;Qty;Units;Price Total;Page
"5/8"" Type X GWB - Walls";Drywall\\Walls;18.50;42;EA;777.00;A2.1
"5/8"" Type X GWB - Ceiling";Drywall\\Ceiling;18.50;18;EA;333.00;A2.1
Joint compound / tape;Drywall\\Finish;14.00;12;EA;168.00;A2.1
2x4x12 Stud;Framing;4.25;86;EA;365.50;A2.1
R13 Batt Insulation;Insulation;32.00;28;EA;896.00;A2.1
Baseboard;Trim;1.85;210;LF;388.50;A2.1
Interior Door;Doors;145.00;6;EA;870.00;A2.1
Door Hardware Set;Doors;28.00;6;EA;168.00;A2.1
Interior Paint;Paint;38.00;8;GAL;304.00;A2.1
Paint Labor;Labor;65.00;16;HR;1040.00;A2.1
Hang Drywall Labor;Labor;55.00;24;HR;1320.00;A2.1
Cleanup Crew;Labor;;4;HR;;A2.1
Demo Dumpster;Demo;475.00;1;EA;475.00;A2.1
Fasteners Allowance;Misc;125.00;1;LS;125.00;A2.1
`

export const ALL_SAMPLE_TEXTS = [
  SAMPLE_NOTES,
  SAMPLE_EXCEL,
  SAMPLE_PLANSWIFT,
  SAMPLE_EXPORT_BY_PAGE,
  SAMPLE_ESTIMATING,
]
