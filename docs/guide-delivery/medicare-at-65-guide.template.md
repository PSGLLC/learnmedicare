---
layout: ../layouts/MedicareGuideLayout.astro
title: "Medicare at 65: A practical {{coverageYear}} guide | Learn Medicare"
description: "A source-linked, plain-language guide to Medicare enrollment at 65 and verified federal Medicare costs for {{coverageYear}}."
path: /medicare-at-65-guide/
datePublished: 2026-11-22
dateModified: {{reviewDate}}
---

# Medicare at 65: a practical {{coverageYear}} guide

**Prepared for editorial review: {{reviewDateDisplay}}**
**Coverage year:** {{coverageYear}} for the amounts below. Enrollment windows are identified separately.
**Publisher:** Learn Medicare, an educational resource from Price Services Group, LLC.

This guide is general education, not a coverage decision or individualized insurance recommendation. Medicare eligibility and enrollment depend on your circumstances. Confirm plan-specific benefits and costs in the plan documents and Medicare Plan Finder.

[{{pdfLinkText}}](/docs/T65-Medicare-Guide.pdf). {{pdfEditionNotice}}


## Start with the four parts

- **Part A** helps cover inpatient hospital care, skilled nursing facility care after a qualifying inpatient stay, hospice, and some home health care.
- **Part B** helps cover physician and outpatient services, preventive care, and durable medical equipment.
- **Part C (Medicare Advantage)** is a private-plan way to receive Part A and Part B benefits. Plans may use provider networks and may include Part D. Benefits and cost sharing vary by plan and location.
- **Part D** is optional prescription drug coverage through private plans, either standalone or included in some Medicare Advantage plans.

Original Medicare does not have a general annual out-of-pocket maximum for Part A and Part B services. Medicare Advantage plans have plan-specific limits for covered Part A and Part B services; read the plan's evidence of coverage. Drug coverage has separate rules and limits. See [Medicare's cost overview](https://www.medicare.gov/basics/costs/medicare-costs).

## When can I enroll?

### Initial Enrollment Period (IEP)

For most people first eligible at 65, the IEP lasts seven months: the three months before the month you turn 65, your birthday month, and the three months after. The date coverage begins can depend on when you enroll. If your birthday is on the first day of a month, Medicare generally treats you as turning 65 in the prior month; check [Medicare's coverage-start table](https://www.medicare.gov/basics/get-started-with-medicare/sign-up/when-does-medicare-coverage-start) for your exact effective date.

### Enrollment through current employment

If you or your spouse has qualifying group health coverage based on **current employment**, you may be able to delay Part B without a late enrollment penalty. The Part B Special Enrollment Period generally lasts eight months after the employment or group coverage ends, whichever happens first. COBRA and retiree coverage do not extend this Part B enrollment window. See [Medicare's current-employment SEP rules](https://www.medicare.gov/basics/get-started-with-medicare/sign-up/when-does-medicare-coverage-start). Ask the employer benefits administrator whether the coverage is based on current employment and how it coordinates with Medicare. Do not rely on employer size alone to decide which coverage pays first.

### Annual Enrollment Period (AEP)

The AEP runs **October 15 through December 7 each year**. Changes made during this window generally take effect **January 1 of the next year**. During the {{enrollmentYear}} AEP, people can make permitted plan changes for coverage beginning January 1, {{coverageYear}}. See [Medicare's AEP guidance](https://www.medicare.gov/health-drug-plans/open-enrollment). If you leave Medicare Advantage for Original Medicare, consider whether you need a standalone Part D plan and review your state-specific Medigap rights; Medigap enrollment is not automatically guaranteed in every situation.

### Medicare Advantage Open Enrollment Period

From January 1 through March 31, a person already enrolled in Medicare Advantage can generally make one change: switch to another Medicare Advantage plan, or return to Original Medicare and join a standalone Part D plan. This is not a second AEP for people in Original Medicare to switch standalone Part D plans.

### Part D special enrollment after drug coverage ends

Part D timing is different from the Part B eight-month window. Losing employer or union drug coverage generally creates a plan enrollment window of two full months after the month coverage ends. For an involuntary loss of creditable drug coverage, the window is generally two full months after the loss or notice, whichever is later. Other situations have different rules. Keep the notice showing whether the prior drug coverage was creditable and confirm your deadline using [Medicare's Part D special-enrollment guidance](https://www.medicare.gov/sign-up-change-plans/joining-a-health-or-drug-plan/special-circumstances-special-enrollment-periods).

## Federal Medicare costs for {{coverageYear}}

CMS announced the {{coverageYear}} amounts on **{{announcementDateDisplay}}**. These are federal amounts effective **{{effectiveDateDisplay}}**. They are not plan quotes; private plan premiums and cost sharing can differ. See the [CMS {{coverageYear}} Part A and B release]({{cmsPartABUrl}}).

### Part A

{{partATable}}

Most people with at least 40 quarters of Medicare-covered work (or an eligible spouse's record) pay no Part A premium. Eligibility rules apply. The inpatient deductible is per benefit period, not a once-per-year deductible.

### Part B

{{partBTable}}

People with higher income may pay an Income-Related Monthly Adjustment Amount (IRMAA) in addition to the standard premium. The premium and deductible do not describe every service's cost sharing.

### Part D standard benefit

{{partDTable}}

The {{partDDeductible}} figure is the maximum deductible for the defined standard benefit; plans may use a lower deductible or a different allowed benefit design. After qualifying out-of-pocket spending reaches the {{coverageYear}} threshold—including certain amounts paid on your behalf under Medicare's rules—the covered Part D drugs included under Medicare's rules have no member cost sharing for the remainder of the calendar year. Check [Medicare's Part D cost guidance]({{medicarePartDUrl}}), your plan's drug list, pharmacies, and other rules. The Part D amount is separate from medical-service costs under Parts A and B.

## Income-related adjustments (IRMAA)

SSA generally uses tax information from two years earlier to determine IRMAA, so {{coverageYear}} determinations generally use {{irmaaTaxYear}} income information. SSA may use another available tax year in some circumstances. If a qualifying life-changing event reduced your income, ask SSA whether you can request a new determination. See [SSA's IRMAA income-year policy]({{ssaIrmaaUrl}}).

The following are {{coverageYear}} monthly amounts from CMS. “Total Part B” includes the {{partBStandardPremium}} standard premium. Part D amount is the additional IRMAA on top of the plan's own premium.

| {{irmaaTaxYear}} tax filing status and income used for {{coverageYear}} | Part B total | Part D IRMAA |
| --- | ---: | ---: |
{{irmaaRows}}

For married people filing separately who lived with a spouse during the year, CMS uses separate thresholds:

| Income used for {{coverageYear}} | Part B total | Part D IRMAA |
| --- | ---: | ---: |
{{separateIrmaaRows}}

Confirm your category and amount with the CMS/SSA notice; these figures do not replace that determination.

## Late enrollment penalties

- **Part B:** The premium generally increases 10% for each full 12-month period you could have had Part B but did not, unless an exception applies (such as a qualifying current-employment Special Enrollment Period). The increase usually lasts as long as you have Part B.
- **Part D:** The penalty is generally 1% of the national base beneficiary premium for each full month without Part D or other creditable drug coverage after the eligible period. For {{coverageYear}}, CMS set that base at {{partDBasePremium}} ([CMS's {{coverageYear}} base-premium release]({{cmsPartDBaseUrl}}); published {{partDBasePremiumPublicationDate}}); the penalty is rounded to the nearest $0.10 and generally continues while you have Part D. Extra Help and other exceptions can apply. This is not 1% of your individual plan premium.
- **Part A:** If you must buy Part A and delay enrollment, the premium may increase 10%; the higher premium generally lasts for twice the number of years you delayed. Exceptions and eligibility details apply.

These are general rules. Keep notices about prior coverage and verify your personal situation with Medicare or Social Security before delaying enrollment. See [Medicare's penalty guidance](https://www.medicare.gov/basics/costs/medicare-costs/avoid-penalties).

## Original Medicare, Medicare Advantage, and Medigap

Original Medicare lets you use providers who accept Medicare, subject to Medicare coverage and cost-sharing rules. Many people add a standalone Part D plan and may consider Medigap to help with certain Original Medicare cost sharing. Medigap does not work with Medicare Advantage and does not generally include prescription drug coverage.

Medigap's federal one-time open enrollment period generally lasts six months beginning when you are 65 or older and enrolled in Part B. After it ends, companies may be able to use medical underwriting unless you have a guaranteed-issue right or your state provides additional protections. State rules differ; see [Medicare's Medigap timing guide](https://www.medicare.gov/health-drug-plans/medigap/ready-to-buy/when) and contact your State Health Insurance Assistance Program (SHIP) for unbiased counseling.

Medicare Advantage plans have plan-specific networks, premiums, prior authorization rules, and cost sharing. Check your doctors, hospitals, medicines, pharmacy, and total expected costs in the plan's current documents and Medicare Plan Finder. A plan's star rating is a quality measure, not a guarantee that a provider, drug, or benefit fits your needs.

## If you have VA, TRICARE, or CHAMPVA coverage

These programs coordinate with Medicare differently. VA health care is not a substitute for Medicare coverage outside the VA system; non-VA care may require VA authorization. People eligible for CHAMPVA generally need Medicare Parts A and B, with limited exceptions. Eligible TRICARE For Life beneficiaries generally need Parts A and B; Medicare usually pays first for services covered by both in the United States. Confirm details with [VA](https://www.va.gov/resources/va-health-care-and-other-insurance/), [CHAMPVA](https://www.va.gov/family-and-caregiver-benefits/health-and-disability/champva/), or [TRICARE](https://www.tricare.mil/medicare) before changing coverage.

## A practical checklist

1. Write down your IEP dates and ask your benefits administrator how current-employment coverage coordinates with Medicare.
2. Keep the employer or plan notice showing when medical and creditable drug coverage ends.
3. Compare {{coverageYear}} plan documents—not only premiums—including doctors, prescriptions, pharmacies, deductibles, and out-of-pocket limits.
4. Confirm enrollment deadlines with Medicare or Social Security before acting. Do not assume a Part B deadline also applies to Part D.
5. Keep the official notices used for your enrollment and cost decisions.

### Official sources

- [CMS: {{coverageYear}} Medicare Parts A and B premiums and deductibles ({{announcementDateDisplay}})]({{cmsPartABUrl}})
- [CMS: {{coverageYear}} Part D benefit parameters (published {{cmsPartDPublicationDate}})]({{cmsPartDParametersUrl}})
- [CMS: {{coverageYear}} Part D base beneficiary premium ({{partDBasePremium}}; published {{partDBasePremiumPublicationDate}})]({{cmsPartDBaseUrl}})
- [Medicare.gov: Part D costs]({{medicarePartDUrl}})
- [Medicare.gov: Medicare costs](https://www.medicare.gov/basics/costs/medicare-costs)
- [Medicare.gov: when Medicare coverage starts](https://www.medicare.gov/basics/get-started-with-medicare/sign-up/when-does-medicare-coverage-start)
- [Medicare.gov: special enrollment periods for drug plans](https://www.medicare.gov/sign-up-change-plans/joining-a-health-or-drug-plan/special-circumstances-special-enrollment-periods)
- [Medicare.gov: Annual Enrollment Period](https://www.medicare.gov/health-drug-plans/open-enrollment)
- [Medicare.gov: avoiding late enrollment penalties](https://www.medicare.gov/basics/costs/medicare-costs/avoid-penalties)
- [Medicare.gov: Medigap enrollment](https://www.medicare.gov/health-drug-plans/medigap/ready-to-buy/when)
- [SSA: Medicare IRMAA]({{ssaIrmaaUrl}})
- [VA: VA health care and other insurance](https://www.va.gov/resources/va-health-care-and-other-insurance/)
- [VA: CHAMPVA and Medicare](https://www.va.gov/family-and-caregiver-benefits/health-and-disability/champva/)
- [TRICARE: Medicare and TRICARE For Life](https://www.tricare.mil/medicare)
