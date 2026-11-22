Prompt #1
[image of low-fidelity image] <- Create a directory to house this new project, create a github repo for the project, and install github's speckit agent skill library to the directory.

Prompt #2
$speckit-constitution [technical rules and behavioral rules]

Prompt #3
Read through the constitution of this project. Ask me questions up-front if there is uncertainty. Your intent is to create a detailed design document for end-to-end construction of the web app described in the constitution, its reference content, online documentation for libraries/external APIs, and surrounding documentation. After the design document section, create a checklist for step-by-step instructions which will mark implementation status of certain technical objective. The checklist's intent is to inform long-running implementation agents of the implementation status at a glace. Inform agents that the checklist is the source of truth and to make sure to both reference and update the checklist.

Prompt #4
Start a fully agentic implementation of the current project based on this design document and its implementation checklist [path to design document].