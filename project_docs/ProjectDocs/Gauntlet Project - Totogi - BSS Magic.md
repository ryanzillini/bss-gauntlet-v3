**BSS Magic Gauntlet Project**  
**Company**: Totogi  
**Contact**:   
Howard Abrams \- [howard.abrams@telcodr.com](mailto:howard.abrams@telcodr.com) (Technical Product EVP) and   
DR \- [dr@telcodr.com](mailto:dr@telcodr.com) (CEO

**Background info:**  
Here's a concise overview:

Telecom operators rely on BSS for critical business operations like billing, customer management, and service activation. Today's telcos typically have hundreds of BSS applications from various vendors, many of which were installed in different decades and are primarily on-premise. These legacy systems are expensive to maintain, slow to change, and create significant technical debt through customizations and complex integrations.

**BSS Magic Overview:**  
BSS Magic is Totogi's innovative solution that revolutionizes how telcos manage their BSS landscape. Instead of adding more AI silos that need customization and integration, BSS Magic takes a unique approach:

1\. It creates a unified ontological layer (based on TM Forum standards) that understands and maps the relationships between different systems' data models  
2\. It deploys AI agents that work above this layer to automate various tasks \- from business analysis to development and testing  
3\. It uses adapters to connect legacy systems to this unified model, making them interoperable without replacing them

The key breakthrough is that BSS Magic doesn't require replacing existing systems or creating more point-to-point integrations. Instead, it brings legacy systems to life by abstracting business logic to an AI layer that can work across any system through the ontological mapping layer. This approach reduces integration time from months to days and allows telcos to innovate without being held back by their legacy infrastructure.

**Starting points:**  
**DARTS**  
D \- domain \- what data / data sets / systems does it operate over \[TELECOM BSS\]  
A \- actions \- what primitive and compound actions does it enable?  side effects?  determinism?  what actions will AI perform under the (AI)PI. \[SCHEMA AND DOCUMENTATION ANALYSIS\]  
R \- rules \- what rules will the AI work within (security, authorization, side effects, our POV on "right" ways, etc.). \[TM FORUM BUSINESS PROCESS FRAMEWORK, BEST PRACTICES, ETC\]  
T \- targets \- what, if anything, will the (AI)PI create for the user.  structured data outputs that can be passed to code, or insights that a human-as-caller can get by working with the (AI)PI  \[DATA TRANSFORMATION CONFIGURATION\]  
S \- simple \- how do you keep this simple and magical for the user (user could be a developer). \[USER DESCRIBES GOALS, AI DOES ANALYSIS AND CREATES WORKING TM FORUM API\]

**What is an (AI) PI?**  
(AI)PI is:

* Industry standard / defacto data model \[TM FORUM\]  
  * Find one that exists, or just use the data model from the 800lb gorilla app in your space (ZenDesk, SalesForce, whatever).  
  * Extend if required  
* Instrument / code so that we can move data in-and-out of legacy systems \[N/A?\]  
  * Old school connectors, with model as the abstraction layer  
  * Can be a brand new back end if we are building ground up.  But, ours is not special, same industry model abstraction  
  * Can we provide a legacy back end for them?  
* (AI)PI code-as-caller: \[AI GENERATES TRANSFORMATION CONFIGURATION THAT MAPS LEGACY API TO TM FORUM\]  
  * API package, docs, examples sufficient to allow AI to write code that uses the model to interact with back end  
  * If we are doing a replacement of a legacy system, should enable "one screen at a time" replacement pattern  
* (AI)PI  LLM-as-caller \[AI CALLS CONFIGURED API TO VALIDATE IT IS WORKING CORRECTLY\]  
  * MCP server (or other tools/function calling pattern) to allow LLMs to interact with model, and perform actions  
  * The "primitives" you expose matter \- these are the critical seams and where software architecture is going  
  * Need to decide what side effects you allow, what functions will be guaranteed deterministic vs. those that may have non-determinism  
  * My view:  LLMs will start handling control flow for apps, allowing dynamic workflows in real time.    
* (AI)PI  human-as-caller: \[HUMAN PASSES GOALS TO AI\]  
  * Command-line / chat interface for humans to directly interact   
  * Should be trivial if we have enabled LLM-as-caller  
  * Question:  Why is this valuable?  It's trivial after LLM as caller, sounds cool but do we need it?  
* TEST2PASS \- don't love this section \[AI CALLS CONFIGURED API TO VALIDATE IT IS WORKING CORRECTLY\]  
  * Like-for-like replacement screen using code-as-caller  
  * Ask LLM to perform some compound action against the back end using LLM-as-caller  
  * Have your agent talk to mine \- NL "conversation" between a caller agent and (AI)PI (that humans can read) to handle an async task, mimicking human-as-caller

**Other files:**  
Product Marketing Brainlift: [https://workflowy.com/s/bss-magic-brainlift/hh8mO8IAAmGs14lq](https://workflowy.com/s/bss-magic-brainlift/hh8mO8IAAmGs14lq)	  
Howard’s Starting Product Spec: [Functional Spec - TelcoDR:BSS Magic - Ontology - Week 6 2025](https://docs.google.com/document/d/1gFQEJPrD0xkh_QJrOu9JVIggHasii_IXRtrOjPimS24/edit?usp=sharing)

DR Blogs:  
The problem we are solving: [https://telcodr.com/insights/ai-to-the-rescue-blog/](https://telcodr.com/insights/ai-to-the-rescue-blog/)	  
The Answer: [https://telcodr.com/insights/ai-first-telco-blog/](https://telcodr.com/insights/ai-first-telco-blog/)

DR Talk at MWC24 (year old vision): [MWC24: Danielle Rios Royston Talk - Unveiling the AI-First Future of BSS](https://youtu.be/d0Pb_G-Bb4g?si=oMGaAhVeiU7x4cje)  
Prototype videos \- posted to Totogi YouTube channel; growing every day.  
Inventory AI Agent: [Inventory AI Agent](https://youtu.be/uf8zNo-VcSc?si=i_UKq6NCVMZuTtIR)	  
Smart Mobility: [BSS Connected Smart Mobility](https://youtu.be/HFtrcPjZFx8?si=1sytbayJBywzlPUH)  
Enterprise Sales Agent:[Enterprise Sales Agent Flow](https://youtu.be/8ccVfOQ7p94?si=6zyeG1r1zRZYBO26)  
Competitive Product Design: [Competitive Product Design](https://youtu.be/pxRlWfe6A70?si=aub5T40SVyFaItB2)	

**Project Goals:**  
Build an enterprise grade V1 of BSS Magic, starting at the data layer using Howard’s product specification. This is a platform that can connect to any other vendor’s BSS product and understand its data structure.

Build an MCP server for the telco data model using [MCP-Hive.](https://mcp-hive.ti.trilogy.com/) You will get most of the(AI)PI functionality out of the box and can then accomplish more in the 100 hours. MCP-Hive is ephor-bus enabled. 

To start, ingest Totogi, CloudSense, and STL to test that it works. These 3 were selected because we own the products and the source code, so we can easily see if your adapter works.

**Bonus:**  
Map the connected system to TM Forum APIs and produce working code to read and write to the system with the TM Forum APIs, converting back and forth to the source’s API set if necessary.

**Bonus Bonus:**  
Automated the certification of CloudSense with the TM Forum APIs and move onto on this leaderboard:  
[https://www.tmforum.org/conformance-certification/open-api-conformance/\#table](https://www.tmforum.org/conformance-certification/open-api-conformance/#table)	

**Bonus Bonus Bonus:**  
Use the automation to certify Totogi with the TM Forum APIs and move up on the leaderboard (currently at 44, could we do more?)