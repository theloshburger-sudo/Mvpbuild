/** PlanSwift pad notes — quantities written by hand after the takeoff. */
export const SAMPLE_NOTES = `PlanSwift takeoff — Kitchen Reno — sheet A2.1
counted walls/ceil off the model, wrote these on the pad:

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

NOTE: add 10% waste on drywall sheets — don't re-key 42 vs 24`

/** Typical office Excel estimate template — copy/paste from the sheet is TSV. */
export const SAMPLE_EXCEL = `Item	Description	Qty	UOM	Unit Price	Notes
1	5/8" Type X drywall (walls + ceil)	42	SHT	18.50	PS A2.1 count
2	Joint compound / tape	12	BKT	14.00	
3	2x4x12 studs	86	EA	4.25	PS count
4	R13 batt insulation	28	BAG	32.00	
5	Paint labor	16	HR	65.00	
6	Interior paint	8	GAL	38.00	
7	Baseboard	210	LF	1.85	PS linear
8	Interior doors	6	EA	145.00	
9	Door hardware	6	SET	28.00	
10	Demo dumpster	1	LS	475.00	
11	Fasteners allowance	1	LS	125.00	
12	Hang drywall labor	24	HR	55.00	
13	Cleanup crew	4	HR		rate missing on template
	NOTE: add 10% waste on drywall sheets — don't transpose 42/24			
`
