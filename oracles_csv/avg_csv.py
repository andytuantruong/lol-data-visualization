import pandas as pd

output_data = pd.read_csv('~/OneDrive/Documents/lol data visualization/parser/output.csv')
data = pd.read_csv('lec_march10.csv')

extracted_data = data[['Player', 'GP', 'K']].copy()

#accounting for two maps played
extracted_data['Avg'] = (extracted_data['K'] / extracted_data['GP'])

combined_data = pd.merge(extracted_data, output_data[['Name', 'prop']], how='left', 
                         left_on=extracted_data['Player'].str.lower(), 
                         right_on=output_data['Name'].str.lower())

combined_data['Difference'] = combined_data['Avg'] - combined_data['prop']
combined_data = combined_data.sort_values(by='Difference', ascending=False)
combined_data.drop(columns=['key_0'], inplace=True)

print(combined_data)