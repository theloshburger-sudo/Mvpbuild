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
 * PlanSwift-style takeoff export (CSV/XLSX the office can dump).
 * Qty / UOM / assembly / sheet refs. Unit Cost is sometimes on the takeoff workbook,
 * often blank — either way, do not re-key these rows into the estimate sheet.
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
