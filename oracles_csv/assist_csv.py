import pandas as pd

pd.set_option('display.max_rows', None)

output_data = pd.read_csv('~/OneDrive/Documents/lol data visualization/oracles_csv/output.csv')
data = pd.read_csv('lck_sep9.csv') 

extracted_data = data[['Player', 'GP','A']].copy() 

# change for amount of maps played
maps_played = 3

extracted_data['Projected Assists'] = (extracted_data['A'] / extracted_data['GP']) * maps_played
combined_data = pd.merge(extracted_data, output_data[['Name', 'prop']], how='left', 
                         left_on=extracted_data['Player'].str.lower(), 
                         right_on=output_data['Name'].str.lower())

combined_data['Difference'] = combined_data['Projected Assists'] - combined_data['prop']
combined_data = combined_data.sort_values(by='Difference', ascending=False)
combined_data.drop(columns=['key_0'], inplace=True)

print(combined_data)