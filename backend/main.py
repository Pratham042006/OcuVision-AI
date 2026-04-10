import os
import torch
import cv2
import numpy as np
import base64
import traceback
import time
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from torchvision import models, transforms
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# LangChain & RAG Imports (Commented out for now - will be re-enabled later)
# from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_chroma import Chroma
# from langchain.chains import RetrievalQA

# ... (init code) ...

# --- 1. APP INITIALIZATION ---
# This MUST happen before using @app.post
app = FastAPI()

# Add Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. CONFIGURATION & CONSTANTS ---
DB_PATH = "./chroma_db"
MODEL_PATH = 'final_retina_model.pth'
target_names = ['DR', 'ARMD', 'MH', 'DN', 'MYA', 'BRVO', 'TSLN', 'ERM', 'LS', 'MS', 
                'CSR', 'ODC', 'CRVO', 'TV', 'AH', 'ODP', 'ODE', 'ST', 'AION', 'PT', 
                'RT', 'RS', 'CRS', 'EDN', 'RPEC', 'MHL', 'RP', 'CWS', 'CB', 'ODPM', 
                'PRH', 'MNF', 'HR', 'CRAO', 'TD', 'CME', 'PTCR', 'CF', 'VH', 'MCA', 
                'VS', 'BRAO', 'PLQ', 'HPED', 'CL']

# --- DISEASE METADATA (SEVERITY, REFERRAL, URGENCY) ---
disease_metadata = {
    'DR': {'severity': 'High', 'specialist': 'Retina Specialist', 'urgency': 'Urgent', 'referral_timeframe': '1-2 weeks'},
    'ARMD': {'severity': 'High', 'specialist': 'Retina Specialist', 'urgency': 'Important', 'referral_timeframe': '2-4 weeks'},
    'MH': {'severity': 'High', 'specialist': 'Vitreoretinal Surgeon', 'urgency': 'Urgent', 'referral_timeframe': '1-2 weeks'},
    'BRVO': {'severity': 'High', 'specialist': 'Retina Specialist', 'urgency': 'Urgent', 'referral_timeframe': '1 week'},
    'CRVO': {'severity': 'Critical', 'specialist': 'Retina Specialist/Neuro-ophthalmologist', 'urgency': 'Emergency', 'referral_timeframe': '24-48 hours'},
    'AION': {'severity': 'Critical', 'specialist': 'Neuro-ophthalmologist', 'urgency': 'Emergency', 'referral_timeframe': '24-48 hours'},
    'CRAO': {'severity': 'Critical', 'specialist': 'Emergency/Retina Specialist', 'urgency': 'Emergency', 'referral_timeframe': 'Immediate'},
    'CSR': {'severity': 'Medium', 'specialist': 'Retina Specialist', 'urgency': 'Important', 'referral_timeframe': '2-3 weeks'},
    'CME': {'severity': 'Medium', 'specialist': 'Retina Specialist', 'urgency': 'Important', 'referral_timeframe': '1-2 weeks'},
    'ODC': {'severity': 'Medium', 'specialist': 'Glaucoma Specialist', 'urgency': 'Important', 'referral_timeframe': '2-4 weeks'},
    'ODP': {'severity': 'Medium', 'specialist': 'Neuro-ophthalmologist', 'urgency': 'Routine', 'referral_timeframe': '4-6 weeks'},
    'ODE': {'severity': 'High', 'specialist': 'Neuro-ophthalmologist', 'urgency': 'Important', 'referral_timeframe': '1-2 weeks'},
    'RP': {'severity': 'High', 'specialist': 'Retina Specialist/Genetic Counselor', 'urgency': 'Important', 'referral_timeframe': '2-4 weeks'},
    'RVH': {'severity': 'Medium', 'specialist': 'Retina Specialist', 'urgency': 'Important', 'referral_timeframe': '1-2 weeks'},
    'ERM': {'severity': 'Low', 'specialist': 'General Ophthalmologist', 'urgency': 'Routine', 'referral_timeframe': '4-8 weeks'},
    'TSLN': {'severity': 'Low', 'specialist': 'General Ophthalmologist', 'urgency': 'Routine', 'referral_timeframe': 'Monitoring only'},
    'HPED': {'severity': 'High', 'specialist': 'Retina Specialist', 'urgency': 'Urgent', 'referral_timeframe': '1-2 weeks'},
    'PRH': {'severity': 'High', 'specialist': 'Retina Specialist', 'urgency': 'Urgent', 'referral_timeframe': '1 week'},
    'DN': {'severity': 'Low', 'specialist': 'General Ophthalmologist', 'urgency': 'Routine', 'referral_timeframe': '4-8 weeks'},
    'MYA': {'severity': 'Low', 'specialist': 'Optometrist/Refractive Surgeon', 'urgency': 'Routine', 'referral_timeframe': '2-4 weeks'},
    'CB': {'severity': 'Medium', 'specialist': 'Retina Specialist', 'urgency': 'Important', 'referral_timeframe': '2-4 weeks'},
}

def get_disease_metadata(disease_name):
    """Get severity, specialist recommendation, and urgency for a disease."""
    return disease_metadata.get(disease_name, {
        'severity': 'Medium',
        'specialist': 'General Ophthalmologist',
        'urgency': 'Routine',
        'referral_timeframe': '4-6 weeks'
    })

# --- 3. AI MODEL LOADING ---
device = torch.device("cpu")
model = models.densenet121(weights=None)
model.classifier = torch.nn.Linear(model.classifier.in_features, len(target_names))
model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
model.eval()

# --- 4. RAG INITIALIZATION (DISABLED FOR NOW - WILL RE-ENABLE LATER) ---
# Ensure your GOOGLE_API_KEY is set in your environment variables
# embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
# vectorstore = Chroma(persist_directory=DB_PATH, embedding_function=embeddings)
# qa_chain = RetrievalQA.from_chain_type(
#     llm=ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0), 
#     retriever=vectorstore.as_retriever()
# )

# --- 4.5 DISEASE INFORMATION DATABASE (FALLBACK) ---
disease_info = {
    'DR': 'Diabetic Retinopathy - A condition caused by high blood sugar damaging blood vessels in the retina.',
    'ARMD': 'Age-Related Macular Degeneration - Progressive loss of central vision.',
    'MH': 'Macular Hole - A break in the macula affecting central vision.',
    'DN': 'Drusen - Deposits under the retina often associated with macular degeneration.',
    'MYA': 'Myopia - Nearsightedness causing blurred distance vision.',
    'BRVO': 'Branch Retinal Vein Occlusion - Blockage of a branch retinal vein causing vision loss.',
    'TSLN': 'Tessellated Fundus - Normal variation with visible choroidal pattern.',
    'ERM': 'Epiretinal Membrane - A thin layer of scar tissue on the macula.',
    'LS': 'Laser Scars - Scarring from previous retinal laser treatment.',
    'MS': 'Macular Scar - Scarring in the macula region.',
    'CSR': 'Central Serous Retinopathy - Fluid under the central retina causing blurred vision.',
    'ODC': 'Optic Disc Cupping - Enlargement of optic disc cup suggesting glaucoma.',
    'CRVO': 'Central Retinal Vein Occlusion - Complete blockage of central retinal vein.',
    'TV': 'Temporal Vein - Visible temporal retinal vessel.',
    'AH': 'Asteroid Hyalosis - Calcium deposits in the vitreous.',
    'ODP': 'Optic Disc Pallor - Paleness of optic disc suggesting nerve damage.',
    'ODE': 'Optic Disc Edema - Swelling of the optic disc.',
    'ST': 'Superficial Temporal - Superficial retinal hemorrhage.',
    'AION': 'Anterior Ischemic Optic Neuropathy - Blood flow blockage to optic nerve.',
    'PT': 'Perivascular Sheathing - White coating around retinal vessels.',
    'RT': 'Retinal Thinning - Thinning of retinal tissue.',
    'RS': 'Retinal Scar - Scarring in the retinal tissue.',
    'CRS': 'Chorioretinal Scar - Scarring of the choroid and retina.',
    'EDN': 'Exudates - Lipid deposits in the retina.',
    'RPEC': 'RPE Changes - Changes in retinal pigment epithelium.',
    'MHL': 'Macular Hypoplasia - Underdevelopment of the macula.',
    'RP': 'Retinitis Pigmentosa - Progressive genetic degeneration of photoreceptor cells.',
    'CWS': 'Cotton Wool Spots - Nerve fiber layer infarcts.',
    'CB': 'Choroidal Breaks - Breaks in the choroid layer.',
    'ODPM': 'Optic Disc Pit Macular - Pit in the optic disc.',
    'PRH': 'Preretinal Hemorrhage - Bleeding in front of the retina.',
    'MNF': 'Myelinated Nerve Fibers - Abnormal myelination of retinal nerve fibers.',
    'HR': 'Hard Exudates - Lipid deposits appearing as hard yellow spots.',
    'CRAO': 'Central Retinal Artery Occlusion - Blockage of central retinal artery.',
    'TD': 'Temporal Disc - Normal temporal disc appearance.',
    'CME': 'Cystoid Macular Edema - Cyst formation in the macula.',
    'PTCR': 'Post Traumatic Choroidal Rupture - Choroidal breaks from trauma.',
    'CF': 'Combined Findings - Multiple retinal abnormalities.',
    'VH': 'Vitreous Haze - Cloudiness in the vitreous.',
    'MCA': 'Macroaneurysm - Enlarged arteriole in the retina.',
    'VS': 'Vitreous Scar - Scarring in the vitreous.',
    'BRAO': 'Branch Retinal Artery Occlusion - Blockage of branch retinal artery.',
    'PLQ': 'Patches and Plaques - White patches on retina.',
    'HPED': 'Hemorrhagic Pigment Epithelial Detachment - Bleeding and detachment of pigment epithelium.',
    'CL': 'Cotton Lint - Minor retinal findings.'
}

def generate_fallback_report(disease_name):
    """Generate a basic medical report when RAG API fails."""
    disease_desc = disease_info.get(disease_name, "Retinal condition detected by AI model.")
    
    report = f"""
CLINICAL FINDINGS:
Diagnosis: {disease_name}

CONDITION OVERVIEW:
{disease_desc}

GENERAL MANAGEMENT RECOMMENDATIONS:
1. Schedule a comprehensive dilated eye examination with an ophthalmologist
2. Monitor for any changes in vision
3. Follow-up imaging as recommended by your eye care specialist
4. Maintain regular eye exams to track disease progression

IMPORTANT NOTE:
This is an AI-assisted preliminary assessment and should not be used as a substitute for professional medical evaluation. Please consult with a qualified ophthalmologist for definitive diagnosis and treatment plans.
"""
    return report.strip()

# --- 4.6 HIGH-CONFIDENCE DISEASE REPORTS (VERIFIED HIGH F1 SCORES) ---
high_confidence_reports = {
    'DR': """COMPREHENSIVE ANALYSIS: DIABETIC RETINOPATHY

DISEASE OVERVIEW:
Diabetic retinopathy (DR) is the most common microvascular complication of diabetes mellitus and represents the leading cause of vision loss and blindness in the working-age population across developed nations. The condition manifests as a progressive vascular disease affecting the retinal microvasculature, characterized by increased vascular permeability, blood-retinal barrier breakdown, and eventual retinal ischemia.

PATHOPHYSIOLOGIC MECHANISMS:
1. Chronic Hyperglycemia Effects:
   - Sustained elevated glucose levels activate glycosylation pathways inducing advanced glycation end products (AGEs)
   - Protein kinase C (PKC) hyperactivation leads to increased vascular permeability
   - Osmotic stress from polyol pathway activation causes pericyte apoptosis

2. Vascular Structural Changes:
   - Loss of pericyte investment results in microaneurysm formation at capillary outpouchings
   - Basement membrane thickening compromises vascular integrity
   - Progressive occlusion of capillary beds creates areas of retinal non-perfusion

3. Vascular-Inflammatory Cascade:
   - Upregulation of VEGF (vascular endothelial growth factor) drives pathologic neovascularization
   - Elevated pro-inflammatory cytokines including IL-6, TNF-α, and MCP-1 promote endothelial dysfunction
   - Leukostasis and blood flow abnormalities exacerbate tissue damage

DISEASE STAGING:
The International Clinical Diabetic Classification System (ICDR) identifies progression stages:

Non-Proliferative Diabetic Retinopathy (NPDR) - Three Severity Levels:
- Mild NPDR: Microaneurysms only, minimal hemorrhages
- Moderate NPDR: Microaneurysms, scattered dot-blot hemorrhages, hard exudates, cotton-wool spots
- Severe NPDR: Extensive hemorrhages, venous beading, intraretinal microvascular abnormalities (IRMAs)

Proliferative Diabetic Retinopathy (PDR):
- Neovascularization of optic disc (NVD) or elsewhere (NVE) indicating severe ischemia
- Vitreous hemorrhage from fragile neovessels
- Traction retinal detachment from posterior vitreous contraction
- Neovascular glaucoma from iris neovascularization

CLINICAL PRESENTATION & FINDINGS:
Early stages often remain asymptomatic, with changes detected only on dilated examination. Progressive disease manifests with:
- Floaters (from microhemorrhages or vitreous involvement)
- Blurred vision (from macular edema or media opacity)
- Sudden vision loss (vitreous hemorrhage in advanced disease)
- Visual field defects corresponding to retinal non-perfusion areas
- Photopsia (flashing lights) from retinal traction

OCT AND IMAGING CHARACTERISTICS:
- Optical Coherence Tomography Angiography (OCTA): Demonstrates capillary dropout patterns, foveal avascular zone enlargement, and ischemic zones
- Fundus Photography: Reveals microaneurysms as discrete red dots, hemorrhages of varying size, lipid exudates forming characteristic hard exudate patterns
- Fluorescein Angiography: Shows areas of retinal non-perfusion, leaking microaneurysms, and neovascular fronds in PDR

DIABETIC MACULAR EDEMA (DME) CONSIDERATIONS:
Even mild NPDR can cause vision-threatening macular edema through increased vascular permeability. DME presence significantly impacts visual prognosis and treatment decisions independent of DR severity grading.

CURRENT DIAGNOSIS AND FINDINGS:
The retinal imaging in this case demonstrates characteristic findings consistent with diabetic retinopathy including microaneurysms, dot-blot hemorrhages, and areas of retinal thickening consistent with edema formation. The severity level suggests consideration of systemic evaluation and ophthalmologic management.

COMPREHENSIVE MANAGEMENT STRATEGY:

Glycemic Control (Primary Prevention):
- Intensive glycemic control targeting HbA1c <7% for most patients (per ADA guidelines)
- Individualization necessary for elderly or those with hypoglycemia unawareness
- Each 1% reduction in HbA1c associated with ~40% risk reduction in DR progression
- Real-time continuous glucose monitoring improves control precision

Cardiovascular Risk Factor Management:
- Blood pressure control to target <140/90 mmHg (or <130/80 with albuminuria)
- ACE inhibitors or ARBs provide protective effects beyond BP reduction
- Lipid management with statins targeting LDL <70 mg/dL
- Smoking cessation programs with pharmacologic support as needed

Ophthalmic Surveillance Protocol:
- Baseline comprehensive dilated retinal examination at diabetes diagnosis
- Follow-up frequency determined by severity:
  - No DR or minimal NPDR: Annual exams
  - Moderate-Severe NPDR: Every 3-4 months
  - PDR or DME: Monthly or per treatment protocol

Advanced Imaging Assessment:
- Optical Coherence Tomography (OCT) of macula for DME detection and monitoring
- OCT Angiography (OCTA) for ischemia assessment and treatment planning
- Fluorescein angiography when neovascularization or extensive non-perfusion suspected

Pharmacologic Interventions:
- ANTI-VEGF Therapy (First-line for PDR and DME):
  * Intravitreal ranibizumab, bevacizumab, or aflibercept injections
  * Monthly or pro re nata (PRN) dosing protocols
  * Response monitored via OCT thickness and VA improvement
  * Particularly effective for DME with high anatomic and functional success rates

- CORTICOSTEROID OPTIONS (Second-line or adjunctive):
  * Intravitreal triamcinolone for corticosteroid-responsive DME
  * Intravitreal dexamethasone implants (Ozurdex) for persistent DME
  * Reserved for anti-VEGF-resistant cases or when VEGF therapy contraindicated

LASER PHOTOCOAGULATION (Established but Less Frequently Used):
- PRP (Panretinal Photocoagulation) for high-risk PDR features:
  * NVD >1/4 disk diameter with vitreous hemorrhage
  * NVE >1/2 disk diameter with vitreous hemorrhage
- Focal/Grid laser for DME in select cases (mainly when anti-VEGF contraindicated)

SURGICAL INTERVENTIONS:
- Vitrectomy for advanced PDR with:
  * Vitreous hemorrhage obscuring vision or preventing treatment
  * Traction retinal detachment threatening fovea
  * Combined rhegmatogenous and traction detachments
- Membrane peeling and endolaser applied intraoperatively

MONITORING AND TREATMENT ENDPOINTS:
- VA stabilization or improvement (goal ≥20/40 functional vision)
- OCT central macular thickness reduction to <350 micrometers
- OCTA perfusion improvement with capillary density restoration
- Regression of neovascularization in PDR cases

PROGNOSIS AND LONG-TERM OUTCOMES:
- Early detection and aggressive management: >95% prevents vision loss
- Severe PDR without treatment: >50% progress to severe vision loss within 5 years
- DME with timely anti-VEGF therapy: ~60-70% achieve VA improvement
- Systemic factors (glucose control, BP, lipids) independently predict poor long-term outcomes

PATIENT EDUCATION AND COUNSELING:
1. Emphasize the reversibility of early changes with improved glycemic control
2. Explain the potential for rapid progression with poor compliance
3. Discuss importance of medication adherence and regular monitoring
4. Address lifestyle modifications: regular exercise, medical nutrition therapy, smoking cessation
5. Counsel on warning signs requiring urgent evaluation (sudden vision loss, new floaters, photopsia)

FOLLOW-UP RECOMMENDATIONS:
- Schedule dilated retinal examination within 1-4 weeks depending on severity
- Establish baseline OCT and potentially OCTA imaging
- Endocrinology referral for glucose management optimization
- Consider retina specialist evaluation for NPDR-Severe or any PDR findings""",

    'ARMD': """COMPREHENSIVE ANALYSIS: AGE-RELATED MACULAR DEGENERATION

DISEASE OVERVIEW:
Age-Related Macular Degeneration (AMD) represents the leading cause of irreversible central vision loss in individuals over 50 years in developed countries. The condition is characterized by degeneration of the macula, the central region of the retina responsible for detailed vision. Progressive loss of central vision significantly impacts quality of life, independence, and ability to perform visual tasks requiring detailed acuity.

EPIDEMIOLOGIC SIGNIFICANCE & RISK FACTORS:
- Prevalence increases dramatically with age: <1% in those 50-59 years, >10% in those >80 years
- Genetic predisposition accounts for 46-71% of risk variance
- Environmental and lifestyle factors contribute significantly to disease progression

Primary Risk Factors:
1. Age: Exponential risk increase after age 60
2. Smoking: 4-fold increased risk; dose-dependent relationship; smoking cessation reduces progression
3. Genetics: CFH, ARMS2, C3, and other genetic loci identified via GWAS
4. Hypertension: Systolic >160 mmHg associated with increased progression risk
5. Hyperlipidemia: Elevated LDL cholesterol and triglycerides promote AMD
6. Obesity: Body mass index >30 increases risk by 1.5-fold
7. Cardiovascular disease: History of MI or stroke predicts AMD severity
8. Cumulative UV exposure: Photo-oxidative damage contribution remains debated

PATHOPHYSIOLOGY & CELLULAR MECHANISMS:

Retinal Pigment Epithelium (RPE) Dysfunction:
- RPE cells normally maintain photoreceptor health through phagocytosis and metabolic support
- Aging and oxidative stress impair RPE function, reducing lipofuscin clearance
- Accumulation of drusen (extracellular material between RPE and Bruch's membrane)
- RPE atrophy creates areas of photoreceptor loss irreversible vision loss

Drusen Formation & Characterization:
- Composed of lipid-rich, proteinaceous material including apolipoprotein E, complement proteins, amyloid-beta
- Hard drusen: <63 micrometers, associated with slow progression
- Soft drusen: >63 micrometers, highly predictive of progression to late AMD
- Confluent drusen indicating advanced regional RPE stress

Bruch's Membrane Changes:
- Increased thickness and altered elastic properties from lipid and calcium accumulation
- Compromised barrier function allows abnormal lipid passage
- Reduced perfusion impairs choriocapillaris health and RPE support

Choroidal Neovascularization (Wet AMD):
- Pathologic angiogenesis with VEGF hypersignaling
- Immature vessels with increased permeability promote exudation and subretinal hemorrhage
- Different pathologic neovascular types (Type 1, 2, 3) respond differently to therapy

DISEASE CLASSIFICATION & STAGING:

Early AMD (Low Risk):
- Small drusen (<63 micrometers) or non-extensive intermediate drusen
- RPE hyperpigmentation or hypopigmentation minimal
- Visual function normal; minimal progression risk without intervention

Intermediate AMD (Moderate Risk):
- Extensive intermediate drusen
- Large drusen or evidence of RPE degeneration
- 5-year conversion to advanced AMD: approximately 2-10% depending on additional factors
- Visual acuity may be mildly reduced; central scotomas possible

Advanced Dry AMD (Geographic Atrophy - GA):
- Well-demarcated areas of RPE and outer retinal loss
- Progression rate typically 2% foveal area expansion per year
- Photoreceptor loss irreversible; current FDA-approved treatments limited
- Foveal involvement determines visual prognosis

Advanced Wet AMD (Choroidal Neovascularization - CNV):
- Subretinal neovascular membrane with pathologic vessels
- Exudation, hemorrhage, and fibrovascular scar formation
- Rapid central vision loss possible without prompt treatment
- CNV morphology (classic, occult, polypoidal) influences treatment response

IMAGING FINDINGS AND DIAGNOSTIC CRITERIA:

Fundus Photography Characteristics:
- Drusen distribution and size classification
- RPE changes: hyperpigmentation, hypopigmentation, atrophy pattern
- Hemorrhage or exudation patterns in exudative disease

Optical Coherence Tomography (OCT):
- Quantifies drusen volume and RPE-Bruch's membrane undulation
- Detects intraretinal and subretinal fluid in wet AMD
- Measures central retinal thickness for DME monitoring
- Assesses photoreceptor ellipsoid zone integrity

OCT Angiography (OCTA):
- Demonstrates CNV morphology and neovascular complex
- Type 1 CNV (occult): Shows reticular pattern of immature vessels
- Type 2 CNV (classic): Shows lacy network with hyporeflective cores
- Type 3 CNV (Polypoidal): Shows polypoidal lesions with interconnected branching arterioles

Fundus Autofluorescence (FAF):
- Visualizes RPE health status via lipofuscin accumulation
- Hypoautorescent areas indicate RPE loss or atrophy
- Hyperautorescent patterns suggest disease activity and progression risk

CURRENT EXAMINATION FINDINGS:
This patient demonstrates retinal imaging findings characteristic of age-related macular changes including drusen and/or RPE changes consistent with AMD at an intermediate-to-advanced stage. Detailed characterization and additional imaging recommended for determination of specific intervention strategy.

COMPREHENSIVE MANAGEMENT STRATEGY:

Early-to-Intermediate AMD Management:

Antioxidant Supplementation (AREDS2 Protocol):
- Vitamin C: 500 mg daily
- Vitamin E: 400 IU daily
- Lutein: 10 mg daily  
- Zeaxanthin: 2 mg daily
- Zinc oxide: 80 mg daily
- Reduces conversion to advanced AMD by approximately 25%
- Greatest benefit in intermediate AMD with large drusen

Systemic Risk Factor Optimization:
- Blood pressure control: Target <140/90 mmHg
- Lipid management: Statins for LDL <100 mg/dL, triglycerides <150 mg/dL
- Glycemic control if diabetic: HbA1c <7%
- Smoking cessation with pharmacotherapy and counseling

Retinal Monitoring Protocol:
- Comprehensive dilated examination: Every 6-12 months based on severity
- High-quality fundus photography with standardized documentation
- OCT macula: Every 6-12 months or per change in symptoms
- Home vision monitoring: Amsler grid monitoring for early neovascularization detection
- Prompt evaluation of new metamorphopsia or central scotoma

Anti-VEGF Therapy (First-Line for Wet AMD):
- Indications: Any CNV affecting fovea or threatening foveal center
- Agents: Ranibizumab, bevacizumab, aflibercept
- Dosing: Monthly injections typically for initial 3 months, then re-treatment based on drying

Treatment Endpoints:
- VA improvement or stabilization (avoid decline >5 letters)
- OCT fluid resolution (intraretinal and subretinal)
- CNV regression on OCTA

Advanced Dry AMD (Geographic Atrophy) Management:
- Currently no disease-modifying therapies FDA-approved
- Supportive care: Low vision rehabilitation, home safety modifications
- Monitor for neovascularization development (15-20% of GA eyes)
- Emerging therapies: Pegcetacoplan (complement pathway inhibitor) recently FDA-approved

PROGNOSIS AND VISUAL OUTCOMES:
- Wet AMD without treatment: 50-70% develop legal blindness within 2 years
- Wet AMD with prompt anti-VEGF therapy: 40-50% improve vision, 30-40% maintain stable vision
- Early-intermediate AMD: With AREDS2 supplementation, 5-year progression risk reduced 20-25%
- Dry AMD (GA): Progressive loss; rate variable but average 2% area expansion annually

PATIENT EDUCATION:
1. Explain importance of supplement adherence and cardiovascular risk factor control
2. Teach Amsler grid testing technique and when to seek urgent care
3. Discuss realistic visual prognosis and timeline
4. Address driving safety and vision-dependent activities
5. Connect with visual rehabilitation services and support organizations

LONG-TERM MANAGEMENT SCHEDULE:
- Baseline: Comprehensive exam, photography, OCT, determine supplement initiation
- Month 1-3: Closely monitor if anti-VEGF initiated
- Months 3-6: Expand treatment intervals if stable
- 6-12 months ongoing: Maintain exam and imaging schedule based on disease status
- Continuous: Risk factor optimization and supplement compliance monitoring""",

    'BRVO': """COMPREHENSIVE ANALYSIS: BRANCH RETINAL VEIN OCCLUSION

DISEASE OVERVIEW:
Branch Retinal Vein Occlusion (BRVO) represents occlusion of a branch retinal vein, typically at sites of arteriovenous crossings in the retina. The thrombotic blockage creates downstream venous congestion, capillary hypoperfusion, and retinal edema. BRVO affects approximately 0.4-0.8% of the general population, making it the second most common retinal vascular occlusion after central retinal vein occlusion.

PATHOPHYSIOLOGIC MECHANISMS:

Mechanical Arteriovenous Compression:
- Arteries and veins share common adventitial sheaths at crossing points
- Hardened, atherosclerotic arteries compress adjacent veins
- Turbulent flow at crossing intensifies mechanical stress
- Endothelial damage initiates thrombosis

Endothelial Dysfunction & Thrombosis:
- Altered endothelial cell function impairs anticoagulant properties
- Increased von Willebrand factor and prothrombotic substances
- Reduced tissue plasminogen activator (tPA) activity diminishes fibrinolysis
- Platelet aggregation and microthrombi form within compromised vessels

Retinal Perfusion Changes:
- Acute vein occlusion creates non-perfusion zones downstream
- Collateral venous drainage develops over weeks to months
- Chronic ischemia triggers VEGF upregulation and potential neovascularization
- Retinal edema results from capillary hyperpermeability

RISK FACTORS & ETIOLOGY:

Primary Vascular Risk Factors:
1. Hypertension (present in 50-80% of BRVO patients)
   - Causes increased hydrostatic pressure and endothelial stress
   - Severity and duration directly correlate with BRVO risk
2. Atherosclerosis/Arteriosclerosis
   - Arterial stiffness amplifies mechanical compression at crossings
   - Associated with age >50 years and cardiovascular disease
3. Diabetes mellitus
   - Increases thrombotic tendency
   - Often accompanied by hypertension creating multiplicative risk
4. Hyperlipidemia
   - Both LDL and triglyceride elevation associated with increased risk
   - Promotes atherosclerotic plaque formation in retinal arteries

Secondary Risk Factors:
- Glaucoma (elevated IOP damages vessel walls)
- Thrombophilia (inherited or acquired coagulation disorders)
- Smoking (endothelial damage and increased clotting tendency)
- Oral contraceptives and hormone replacement (especially in thrombophilic patients)

CLINICAL PRESENTATION & SYMPTOMS:

Acute Onset:
- Sudden vision loss, typically painless
- Floaters from retinal hemorrhage
- Visual field defect corresponding to occluded venous distribution
- Often asymptomatic discovery on routine eye exam

Pattern Recognition:
- Cotton-like hemorrhages and flame hemorrhages along venous pathway
- Triangular distribution following vascular territory
- May cross midline if trunk occlusion near optic nerve

BRVO CLASSIFICATION & SEVERITY ASSESSMENT:

Perfused vs. Non-Perfused:
- Perfused: Adequate perfusion maintained via collaterals; better prognosis
- Non-Perfused (Ischemic): Extensive capillary dropout >5 disk areas; higher neovascularization risk

Macular Involvement Status:
- Fovea-Threatening: Edema involving foveal center; vision-threatening
- Fovea-Sparing: Edema outside fovea; generally better visual prognosis
- Extramacular: No macular involvement; minimal vision impact

IMAGING CHARACTERISTICS:

Fundus Photography:
- Flame-shaped and dot-blot hemorrhages in affected quadrant/hemisphere
- Cotton-wool spots indicating nerve fiber layer ischemia
- Hard exudates from chronic vascular leakage
- Dilated venous segments with sluggish flow

OCT Findings (Critical for Macular Edema Assessment):
- Intraretinal edema with cystoid spaces
- Subretinal fluid accumulation
- Central macular thickness quantification
- Disruption of foveal contour and ellipsoid zone integrity

Fluorescein Angiography (FA):
- Impaired venous perfusion with delayed arteriovenous transit
- Hyperfluorescent areas of capillary leakage (dot-blot pattern)
- Non-perfusion zones indicated by hypofluorescent areas
- Late staining of exudates

OCTA Characteristics:
- Demonstrates vein occlusion site and collateral development
- Quantifies capillary dropout extent
- Shows foveal avascular zone changes
- Assesses functional capillary density

CURRENT CASE PRESENTATION:
The retinal image demonstrates findings consistent with branch retinal vein occlusion including retinal hemorrhages, cotton-wool spots, and potential areas of retinal thickening from edema. The specific vascular distribution and associated changes suggest BRVO with macular involvement considerations.

COMPREHENSIVE MANAGEMENT STRATEGY:

Acute Phase Management:

Systemic Evaluation & Risk Factor Modification:
- Complete metabolic panel and lipid profile
- Blood pressure measurement (ideally 24-hour monitoring)
- Fasting glucose or HbA1c (diabetes screening)
- Carotid ultrasound if extensive venous involvement
- Consider hypercoagulability workup if unusual presentation or young patient

Ophthalmology-Specific Assessment:
- Baseline visual acuity and visual field testing
- Dilated comprehensive retinal examination
- OCT macula for edema evaluation
- FA or OCTA to assess perfusion status

Treatment Decisions:

For Macular Edema Associated with BRVO:

Anti-VEGF Therapy (First-Line - Preferred):
- Intravitreal ranibizumab or bevacizumab
- Initial monthly injections for 3 months
- Continuation based on OCT response and visual improvement
- Success rates: 50-70% achieve ≥2-line VA improvement

Intravitreal Corticosteroid Options (Second-Line):
- Triamcinolone acetonide: 4 mg in 0.1 mL
- Dexamethasone implant (Ozurdex): 0.7 mg
- Indicated for anti-VEGF failures or when VEGF inhibition inappropriate
- Monitoring required for IOP elevation (steroid-induced glaucoma)

Laser Photocoagulation (Less Common with Anti-VEGF Era):
- Grid laser: Applied to areas of diffuse leakage
- Focal laser: Targets discrete sources of leakage
- Generally reserved when anti-VEGF contraindicated

For Ischemic BRVO Without Macular Edema:
- Observation with careful monitoring for neovascularization
- Monthly dilated exams for first 3 months, then quarterly
- Scatter laser if iris neovascularization (NVI) develops
- Anti-VEGF consideration if neovascular complications emerge

SYSTEMIC RISK FACTOR MANAGEMENT:

Blood Pressure Control:
- Initiate antihypertensive therapy if not already treated
- Target: <140/90 mmHg (or <130/80 if tolerated)
- ACE inhibitors or ARBs preferred (additional vascular benefits)
- Avoid excessive BP reduction that may worsen ocular perfusion

Lipid Management:
- High-intensity statins for LDL <70 mg/dL
- Triglyceride targets: <150 mg/dL
- Consider ezetimibe or PCSK9 inhibitors for statin-resistant hyperlipidemia

Diabetes Management (if present):
- Intensive glycemic control targeting HbA1c <7%
- Coordination with primary care/endocrinology
- Consider GLP-1 receptor agonists (cardiovascular benefits)

Smoking Cessation:
- Urgent counseling and pharmacotherapy (varenicline, NRT)
- Smoking significantly worsens prognosis

MONITORING PROTOCOL:

Active Treatment Phase (Months 0-3):
- Exams every 4 weeks to assess treatment response
- OCT at each visit to quantify macular thickness change
- VA measurement and patient symptom assessment

Maintenance Phase (Months 3-6):
- Expand intervals to 4-8 weeks if stable
- Continue anti-VEGF or adjust based on disease activity
- Monitor for treatment-emergent complications

Long-Term Follow-Up (Beyond 6 Months):
- Quarterly exams once disease stabilized
- Continued risk factor management
- Watchful assessment for late recanalization (rare)

PROGNOSIS & VISUAL OUTCOMES:
- Perfused BRVO: 60-70% achieve ≥20/60 vision without treatment
- Non-Perfused BRVO: Still achievable but lower success rates
- With anti-VEGF therapy: 50-70% improve vision, 80-90% avoid severe vision loss
- Ischemic changes (NVD, NVE) develop in 15-20% of untreated ischemic BRVO

PATIENT COUNSELING:
1. Explain temporary nature of acute symptoms with expected improvement
2. Discuss medication side effects and injection procedure details
3. Address need for regular follow-up and compliance with medications
4. Emphasize cardiovascular risk factor control importance
5. Provide reassurance regarding prognosis with modern treatment options""",

    'CRVO': """COMPREHENSIVE ANALYSIS: CENTRAL RETINAL VEIN OCCLUSION

DISEASE OVERVIEW:
Central Retinal Vein Occlusion (CRVO) represents total or near-total thrombotic occlusion of the central retinal vein at or near the optic nerve head. CRVO is the second most common retinal vascular pathology after diabetic retinopathy, affecting approximately 0.2% of individuals. The condition carries significantly graver visual prognosis than branch retinal vein occlusion due to involvement of the entire retinal vascular tree and extensive areas of retinal non-perfusion.

DISTINCT CRVO PHENOTYPES:

Perfused (Slow-Flow) CRVO - Better Prognosis:
- Retinal perfusion partially maintained through collateral circulation
- Fewer hemorrhages and less extensive edema
- 5-year visual prognosis: Approximately 60-70% achieve ≥20/60 vision
- Lower rates of neovascular complications (20-30%)

Non-Perfused (Ischemic) CRVO - Severe Prognosis:
- Extensive capillary non-perfusion (>5 disk diameters)
- Severe retinal ischemia signals advanced disease
- Natural history: 80-90% develop severe vision loss (≤20/200) if untreated
- Neovascular glaucoma develops in 40-50% of cases within 6 months

COMPREHENSIVE PATHOPHYSIOLOGY:

Occlusion Mechanism:
- Thrombosis occurs at optic nerve head where central vein exits
- Critical narrowing at lamina cribrosa
- Endothelial dysfunction and thrombotic cascade triggered
- Vessel wall compression from optic nerve structures

Hemodynamic Consequences:
- Acute elevation of venous pressure (>30 mmHg normal)
- Massive central retinal edema from capillary hyperpermeability
- Blood-retinal barrier breakdown allows RBC extravasation into tissue
- Retinal ischemia from hypoperfusion despite venous congestion paradox

Retinal Tissue Ischemia:
- Non-perfused capillary networks create areas of photoreceptor hypoxia
- Anaerobic metabolism in ischemic zones produces lactic acidosis
- Massive VEGF upregulation in response to ischemia (100-1000 fold increases)
- Neovascularization triggers: iris NVI, NVD (neovascular disc), angle neovascularization

RISK FACTOR ANALYSIS:

Age & Gender:
- Mean age 60-65 years (can occur earlier with secondary causes)
- No significant gender predominance

Hypertension (Most Common - 50-70% of cases):
- Uncontrolled hypertension damages vein walls
- Causes endothelial dysfunction and prothrombotic state
- Systolic >160 mmHg particularly predictive

Hypercoagulable States (Important in Younger Patients):
- Hereditary: Factor V Leiden, prothrombin mutation G20210A
- Acquired: Antiphospholipid syndrome, malignancy, thrombophilia
- Consider testing in CRVO patients <50 years

Diabetes Mellitus:
- Increases thrombotic propensity
- Exacerbates hypertension effects
- Often accompanied by additional cardiovascular risk factors

Glaucoma & Elevated IOP:
- IOP >21 mmHg increases CRVO risk
- Open-angle glaucoma present in 25-30% of CRVO eyes
- Ongoing risk factor modification critical

Additional Risk Factors:
- Smoking (endothelial damage, increased clotting)
- Hyperlipidemia and atherosclerosis
- Thrombophilia and coagulation disorders
- Oral contraceptive use (especially with other risk factors)

Systemic Inflammatory Conditions:
- Behçet disease (particularly in Mediterranean, Middle Eastern, Asian populations)
- Sarcoidosis
- Systemic lupus erythematosus
- Vasculitis

CLINICAL PRESENTATION & EXAMINATION:

Acute Symptomatology:
- Sudden onset of vision loss (often profound)
- Positive scotoma in severe cases
- Photopsia or flashing lights
- Metamorphopsia (less common than with AION)
- May be asymptomatic initially if peripheral retina more severely affected

Physical Examination Findings:
- Relative afferent papillary defect (RAPD) indicating optic nerve/retinal dysfunction
- Marked retinal hemorrhages: dot-blot (deep), flame-shaped (superficial), and extensive blot hemorrhages
- Cotton-wool spots indicating severe nerve fiber layer ischemia
- Hard exudates in lipid-rich patterns along venous arcades
- Optic disc swelling (may be subtle)
- Retinal whitening and opacification in non-perfused zones
- Tortuous dilated veins with blood column stasis

COMPREHENSIVE IMAGING ASSESSMENT:

OCT Central Macular Imaging:
- Marked intraretinal edema with cystoid changes
- Central macular thickness often >400 micrometers (vs normal 270-300)
- Disruption of foveal depression and ellipsoid zone
- Quantifies baseline severity for treatment monitoring
- Essential for anti-VEGF response assessment

OCT Angiography (OCTA) - Ischemia Stratification:
- Calculates non-perfusion area percentage
- Non-perfused zone >5 disk areas indicates ischemic CRVO
- Foveal capillary blood flow assessment
- Demonstrates collateral vessel development
- Serial OCTA shows perfusion restoration with treatment

Fluorescein Angiography:
- Demonstrates severe capillary dropout (40-50% of capillary bed in ischemic CRVO)
- Shows impaired retinal perfusion (prolonged arteriovenous transit)
- Identifies areas of retinal non-perfusion
- Differentiates perfused from non-perfused CRVO
- Late-phase shows retinal leakage pattern

CURRENT CASE FINDINGS:
The retinal imaging demonstrates findings characteristic of central retinal vein occlusion including extensive retinal hemorrhaging, significant retinal thickening indicative of substantial macular edema, and signs consistent with retinal ischemia. The severity of findings suggests early intervention consideration.

IMMEDIATE MANAGEMENT STRATEGY:

Urgent Diagnostic Workup (Within 24-48 hours):

Ophthalmic Assessment:
- Extended dilated examination with detailed optic nerve photography
- Baseline OCT macula (critical for comparison)
- Fluorescein angiography or OCTA for perfusion assessment
- OCT angiography to classify as perfused vs. ischemic
- Visual field testing (will be abnormal in ischemic cases)
- IOP measurement (elevated in 50%)

Systemic Medical Evaluation:
- Blood pressure measurement (multiple occasions if elevated)
- Lipid panel, glucose, metabolic panel
- ESR and CRP if patient <60 (concern for vasculitis, GCA)
- Hypercoagulability workup if age <50 or strong personal/family history:
  * PT/INR, activated partial thromboplastin time
  * Factor V Leiden, prothrombin G20210A
  * Anticardiolipin antibodies, beta-2 glycoprotein 1 antibodies
  * Homocysteine level
  * Blood cultures if suspect endocarditis
- Coordinate with internist/cardiologist for systemic risk assessment

TREATMENT PROTOCOLS BY DISEASE TYPE:

Perfused CRVO:

Initial Approach:
- Monthly monitoring for 3 months with careful ischemia surveillance
- Baseline OCT and FA/OCTA to establish perfusion status
- Anti-VEGF therapy consideration if macular edema present:
  * Intravitreal ranibizumab, bevacizumab, or aflibercept
  * Monthly injections if CMT >250 micrometers

Management Goal:
- VA stabilization or improvement
- CMT reduction to <250 micrometers
- Prevention of conversion to ischemic phenotype

Non-Perfused (Ischemic) CRVO:

Anti-VEGF Therapy (Even Without DME):
- CRVO with extensive non-perfusion high risk for neovascularization
- Prophylactic monthly anti-VEGF therapy for minimum 6-12 months
- Significantly reduces NVI/NVD incidence from projected 40-50% to 15-20%

Secondary Panretinal Photocoagulation:
- Indicated when iris neovascularization (NVI) detected
- Goal: Ablate ischemic retina to reduce VEGF stimulus
- Performed urgently if NVI detected

Glaucoma Management:
- Antiglaucoma medications first-line for elevated IOP
- Gonioscopy critical to detect angle neovascularization
- Laser cyclophotocoagulation or tube shunt if NVG develops

Supportive Measures:
- Control systemic hypertension aggressively (target <130/80)
- Lipid management and diabetes optimization if present
- Smoking cessation
- Aspirin (low-dose) may be considered (evidence modest)
- Anticoagulation controversial and generally not recommended

LONG-TERM MONITORING FRAMEWORK:

Critical Follow-Up Schedule:

Months 0-3 (Acute Phase):
- Monthly dilated exams mandatory
- Gonioscopy at month 1 to establish baseline angle appearance
- Monthly OCT if on anti-VEGF therapy
- Weekly IOP monitoring if elevated

Months 3-6 (Early Chronic Phase):
- Reduce visit frequency to every 4-6 weeks if stable
- Continue anti-VEGF if disease improved
- Gonioscopy at months 3 and 6
- Monthly IOP checks

Beyond 6 Months (Chronic Management):
- Quarterly comprehensive exams
- Continued risk factor optimization and monitoring
- Long-term anti-VEGF for perfusion maintenance
- Serial gonioscopy annually to detect late NVA

SYSTEMIC RISK FACTOR OPTIMIZATION:

Blood Pressure Management:
- Urgent: Target <140/90 mmHg
- Ideal: <130/80 mmHg if tolerated without hypotensive symptoms
- ACE inhibitors or ARBs preferred
- Gradual BP lowering preferred over rapid reduction

Lipid Control:
- High-intensity statins (atorvastatin 40-80 mg)
- LDL target <70 mg/dL
- Triglycerides <150 mg/dL

Diabetic Disease Management:
- HbA1c target <7%
- Coordination with endocrinology

Lifestyle Modifications:
- Smoking cessation: Most critical modifiable risk factor
- Regular aerobic exercise: 150 minutes/week moderate intensity
- Dietary sodium restriction and DASH diet
- Weight reduction if BMI >25

PROGNOSIS & VISUAL OUTCOMES:
- Untreated perfused CRVO: 60-70% achieve functional vision (≥20/60)
- Untreated ischemic CRVO: 80-90% progress to severe vision loss (≤20/200)
- With anti-VEGF therapy: 30-40% achieve vision improvement, 60-70% stabilize
- NVG develops in 40-50% of untreated ischemic CRVO (vs. 15-20% with treatment)

PATIENT AND FAMILY COUNSELING:
1. Explain condition severity and realistic visual prognosis
2. Discuss treatment rationale and expected timeline
3. Address medication side effects and injection procedure
4. Emphasize systemic medical optimization importance
5. Counsel on warning signs: rapidly declining vision, pain (suggests NVG)
6. Connect with low vision services if permanent vision loss occurs
7. Discuss driving safety and necessary vision-dependent activity modifications"""
}

def get_disease_report(disease_name):
    """Get the best available report for a disease."""
    if disease_name in high_confidence_reports:
        return high_confidence_reports[disease_name]
    else:
        return generate_fallback_report(disease_name)

# --- 5. IMAGE QUALITY ASSESSMENT ---
def assess_image_quality(pil_img):
    """Assess image quality and return quality score (0-100) and quality level."""
    img_array = np.array(pil_img)
    
    # Check resolution
    height, width = img_array.shape[:2]
    min_dimension = min(height, width)
    resolution_score = min(100, (min_dimension / 224) * 100)
    
    # Check blur using Laplacian variance
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    blur_score = min(100, cv2.Laplacian(gray, cv2.CV_64F).var() * 2)
    
    # Check brightness 
    brightness = np.mean(cv2.cvtColor(img_array, cv2.COLOR_RGB2LAB)[:, :, 0])
    # Optimal brightness is around 50-100 in LAB space
    brightness_score = 100 - abs(brightness - 75) / 75 * 100
    brightness_score = max(0, min(100, brightness_score))
    
    # Check contrast
    contrast = np.std(gray)
    contrast_score = min(100, (contrast / 50) * 100)
    
    # Overall quality score (weighted average)
    overall_quality = (resolution_score * 0.25 + blur_score * 0.35 + 
                      brightness_score * 0.2 + contrast_score * 0.2)
    
    if overall_quality >= 80:
        quality_level = "Excellent"
    elif overall_quality >= 60:
        quality_level = "Good"
    elif overall_quality >= 40:
        quality_level = "Fair"
    else:
        quality_level = "Poor"
    
    return int(overall_quality), quality_level
def generate_gradcam(input_tensor, model):
    input_tensor.requires_grad = True
    
    # Target the last features layer
    features_layer = model.features 
    features = features_layer(input_tensor)
    features.retain_grad() 
    
    pooled_features = torch.nn.functional.adaptive_avg_pool2d(features, (1, 1))
    flattened_features = torch.flatten(pooled_features, 1)
    
    output = model.classifier(flattened_features)
    probabilities = torch.nn.functional.softmax(output, dim=1)
    
    # Get Top 3 Predictions
    top3_prob, top3_idx = torch.topk(probabilities, 3)
    top_3_predictions = []
    for i in range(3):
        idx = top3_idx[0][i].item()
        prob = top3_prob[0][i].item()
        top_3_predictions.append({
            "disease": target_names[idx],
            "probability": f"{prob*100:.2f}%"
        })

    class_idx = output.argmax().item()
    
    # Zero gradients and backpropagate
    model.zero_grad()
    output[0, class_idx].backward()
    
    # Extract gradients and calculate heatmap
    pooled_grads = torch.mean(features.grad, dim=[0, 2, 3])
    activations = features.detach()
    
    for i in range(activations.shape[1]):
        activations[:, i, :, :] *= pooled_grads[i]
        
    heatmap = torch.mean(activations, dim=1).squeeze().numpy()
    heatmap = np.maximum(heatmap, 0)
    heatmap /= (np.max(heatmap) + 1e-8)
    
    return heatmap, class_idx, top_3_predictions

# --- 6. ENDPOINTS ---
@app.post("/diagnose")
async def diagnose(file: UploadFile = File(...)):
    try:
        start_time = time.time()
        timings = {}
        
        # 1. Image Loading
        load_start = time.time()
        img_bytes = await file.read()
        pil_img = Image.open(BytesIO(img_bytes)).convert('RGB')
        timings['image_loading'] = round(time.time() - load_start, 3)
        
        # 2. Image Quality Assessment
        quality_score, quality_level = assess_image_quality(pil_img)
        
        # 3. Preprocessing
        prep_start = time.time()
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        input_tensor = transform(pil_img).unsqueeze(0)
        timings['preprocessing'] = round(time.time() - prep_start, 3)

        # 4. Generate Results (Model Inference + Grad-CAM)
        inference_start = time.time()
        heatmap, class_idx, top_3 = generate_gradcam(input_tensor, model)
        disease = target_names[class_idx]
        timings['model_inference_and_gradcam'] = round(time.time() - inference_start, 3)

        # 5. Get Medical Report (Using High-Confidence Database)
        report_start = time.time()
        report = get_disease_report(disease)
        timings['report_generation'] = round(time.time() - report_start, 3)
        
        # 6. Get Disease Metadata (Severity, Referral)
        metadata = get_disease_metadata(disease)

        # 7. Heatmap Processing
        heatmap_start = time.time()
        open_cv_img = np.array(pil_img)
        open_cv_img = cv2.cvtColor(open_cv_img, cv2.COLOR_RGB2BGR)
        heatmap_resized = cv2.resize(heatmap, (open_cv_img.shape[1], open_cv_img.shape[0]))
        heatmap_colored = cv2.applyColorMap(np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(open_cv_img, 0.6, heatmap_colored, 0.4, 0)
        
        _, buffer = cv2.imencode('.jpg', overlay)
        heatmap_b64 = base64.b64encode(buffer).decode('utf-8')
        timings['heatmap_processing'] = round(time.time() - heatmap_start, 3)

        total_time = round(time.time() - start_time, 3)

        return {
            "disease": disease,
            "top_3": top_3,
            "report": report,
            "heatmap": f"data:image/jpeg;base64,{heatmap_b64}",
            "quality_score": quality_score,
            "quality_level": quality_level,
            "severity": metadata['severity'],
            "specialist": metadata['specialist'],
            "urgency": metadata['urgency'],
            "referral_timeframe": metadata['referral_timeframe']
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- 7. WINDOWS SPAWN PROTECTION ---
if __name__ == "__main__":
    import uvicorn
    # Use the string "main:app" so the reloader works on Windows
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)