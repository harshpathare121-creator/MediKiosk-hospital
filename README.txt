
MediKiosk Adaptive Questionnaire

Files:
- adaptive-questionnaire.js = new patient adaptive questionnaire
- server-adaptive-patch.txt = exact backend changes
- README.txt = instructions

To integrate:
1. Add <script src="adaptive-questionnaire.js"></script> before </body>.
2. In the existing register() function, after creating FormData, call:
   appendAdaptiveToFormData(fd)
3. Apply server-adaptive-patch.txt to server.js.

The current issue starts the flow. The questionnaire category changes according
to the patient's description, and the resulting structured summary is sent to
the doctor.
