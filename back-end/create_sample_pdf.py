import fitz

doc = fitz.open()
page = doc.new_page()
text = (
    "Sample Thesis Title\n\n"
    "This is a concise sample thesis text for testing the upload endpoint.\n"
    "It includes a sample claim and a citation: (Smith, 2020).\n\n"
    "Method: We tested X using Y. Results are preliminary."
)
page.insert_text((72, 72), text, fontsize=12)
doc.save("sample.pdf")
print("sample.pdf created")
