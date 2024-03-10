import pandas as pd

output_data = pd.read_csv('output.csv')
data = pd.read_csv('lpl_march9.csv')

extracted_data = data[['Player', 'GP', 'K']].copy()

#accounting for two maps played
extracted_data['Avg'] = (extracted_data['K'] / extracted_data['GP']) * 2

extracted_data_sorted = extracted_data.sort_values(by='Avg', ascending=False)
combined_data = pd.merge(extracted_data_sorted, output_data[['Name', 'prop']], how='left', left_on='Player', right_on='Name')
combined_data['Difference'] = combined_data['Avg'] - combined_data['prop']
combined_data = combined_data.sort_values(by='Difference', ascending=False)

print(combined_data)