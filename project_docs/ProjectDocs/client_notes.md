Could we add a requirement that we should be able to automate the certification of each TMF API we build against the TMF compliance process. It would be a valuable output of this work if it can also help get us back to and keep us at the top of the compliance leaderboard (https://www.tmforum.org/conformance-certification/open-api-conformance/).
Show less
Howard Abrams
Howard Abrams
6:17 PM Feb 9
The assumption is that we are building all of them at once - it's just a mater of what data sources you actually map to them.   I had already put "conformance" in the last test case, but I'll put in a NFR for it as well.

I was under the impression the conformance tests were already automated. (it's been a while since I've looked at them)



Can i suggest we add a layer below this to highlight the overall BSS architecture? Catalogue, charging, CPQ, Order Management etc. The Service layer of the underlying systems and their overall data set is important for us to define (almost assume) to ensure we enforce best practices. Eg the ontology should be able to support true catalogue federation and centralised catalogues. Commercial, charging and service catalogues defined at design time but working in sync in run time without the need for long complex product launch cycles
Show less
Howard Abrams
Howard Abrams
10:32 AM Feb 11
I'm not understanding what you are suggesting to change.  Is it that you just want to show that there are different systems? Does it change something in this spec, or you want to show it for another reason?
Vish Kumar
Vish Kumar
3:24 AM Feb 12
@howard.abrams@devfactory.com- when we do the mappings there is a level of business logic that also accompanies these integrations. For the BSS we need to be clear that BSS magic will respect the service layer and the logic that is associated with the integrations. Ie, TMF620 (catalogue API, needs to support publish, update etc, But will also need to support the channels and their requirements (ie online may have a subset with different discounts). For OSS system using TMF620 for a "get" the spec is different again as they don't care to much for the commercial construct but more of the technical requirements for the CFS.

If we are going to align this to TMF ODA and the APIs we will need to ensure the best practice flows are also aligned to ETOM, if not we will find gaps in the API Specs as they are defined with ETOM processes in mind.
Howard Abrams
Howard Abrams
11:27 AM Feb 11
added.


Considering the SoR is most likely on-prem, where will the runtime adapter be deployed?
Michael Selig
Michael Selig
4:00 PM Feb 10
Suggestion from past experience I would make at least part of the adapters deployable on prem.
Either as a basic connector, that authenticates against the customer system and to TotogBSS platform so you open the FW from inside and then the mapping is performed on the cloud
or
as an adapter that converts the system APIs into TM Forum which can be beneficial if system isn't REST enabled.
Show less
Marc Breslow
Marc Breslow
4:02 PM Feb 10
agree. I'd also make them ODA Canvas compliant, so they can deploy into infrastructure telco's may already have
Howard Abrams
Howard Abrams
9:10 PM Feb 10
We can look into that in another spec.

I can create a separate TestRail project for this so we capture tests from the start. Or do you think it's too early?
Howard Abrams
Howard Abrams
6:13 PM Feb 9
Too early, plus I (well, ChatGPT) made these test cases very high-level to start.  I just wanted to make sure there was enough here that they knew what we were expecting.

What are the inputs?

I envision system documents and API docs being the norm and direct data source access being the exception. 

In your sample sources, OneBill wouldn't share DB access and CloudSense at least partially uses SFDC record so would be via API.
Show less
Howard Abrams
Howard Abrams
11:29 AM Feb 11
Updated to make it more clear there is an expectation of inputs from the customer.
