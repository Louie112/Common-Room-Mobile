import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import getGlobalStyles from '../../../app/globalStyles';
import { useRouter } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  arrayRemove,
} from '@react-native-firebase/firestore';

import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';

import { app } from '../../../configs/firebaseConfig';

export default function Manage() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const [items, setItems] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [user, setUser] = useState(null);
  const [loadingCreated, setLoadingCreated] = useState(true);
  const [loadingShared, setLoadingShared] = useState(true);
  const router = useRouter();
  const isFocused = useIsFocused();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [welcome3ModalVisible, setWelcome3ModalVisible] = useState(false);
  const [welcome5ModalVisible, setWelcome5ModalVisible] = useState(false);
  const [welcome6ModalVisible, setWelcome6ModalVisible] = useState(false);
  const [firstItemYet, setFirstItemYet] = useState(false);
  const [noFriends, setNoFriends] = useState(false);
  const [noFriendsVisible, setNoFriendsVisible] = useState(false);

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);

  // Function to handle search input changes:
  const handleSearch = (query) => {
    setSearchQuery(query);
    const lowerQuery = query.toLowerCase();
    const combined = [...items, ...sharedItems];
    // Remove duplicates based on the unique item id
    const uniqueResults = combined.filter((item, index, self) =>
      index === self.findIndex((i) => i.id === item.id)
    );
    // Filter the combined list by the search query
    const filtered = uniqueResults.filter((item) =>
      item.name.toLowerCase().includes(lowerQuery)
    );
    setFilteredResults(filtered);
  };

  const toggleDelete = () => {
    if (!showDelete) {
      Alert.alert(
        'Toggle remove mode?',
        'Turn on to remove shared items from your account',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: () => setShowDelete(true),
          },
        ],
        { cancelable: false }
      );
    } else {
      setShowDelete(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    if (user?.uid && isFocused) {
      const db = getFirestore();
      const userDocRef = doc(db, "users", user.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists) {
            const data = docSnap.data();
            if (data.welcome3) {
              setWelcome3ModalVisible(true);
            }
            if (data.firstItemYet) {
              setFirstItemYet(true);
            }
            if (data.welcome6) {
              setWelcome6ModalVisible(true);
            }
            if (data.associated.length === 0) {
              setNoFriends(true);
            }
            if (data.noFriendsVisible) {
              setNoFriendsVisible(true);
            } else {
              setNoFriendsVisible(false)
            }
          } else {
            console.warn("user document does not exist.");
          }
        }, (error) => {
          console.error("Error fetching user details:", error);
        })
    }
  }, [user, isFocused]);  

  // Listen for Auth state changes, and when a user is available, start Firestore listeners
  useEffect(() => {
    const authInstance = getAuth(app);
    let unsubscribeItems, unsubscribeSharedItems;

    const unsubscribeAuth = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (isFocused && currentUser) {
        unsubscribeItems = fetchItems(currentUser.uid);
        unsubscribeSharedItems = fetchSharedItems(currentUser.email);
      } else {
        setLoadingCreated(false);
        setLoadingShared(false);
        if (unsubscribeItems) unsubscribeItems();
        if (unsubscribeSharedItems) unsubscribeSharedItems();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeItems) unsubscribeItems();
      if (unsubscribeSharedItems) unsubscribeSharedItems();
    };
  }, [isFocused]);

  // Function to fetch items created by the current user
  const fetchItems = (userId) => {
    try {
      const db = getFirestore(app);
      const itemsQuery = query(
        collection(db, 'items'),
        where('userId', '==', userId)
      );
      const unsubscribe = onSnapshot(itemsQuery, (querySnapshot) => {
        if (querySnapshot) {
          const itemsList = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setItems(itemsList);
          setLoadingCreated(false);
        } else {
          setLoadingCreated(false);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching items: ', error);
      setLoadingCreated(false);
      return () => {};
    }
  };

  // Function to fetch items shared with the current user
  const fetchSharedItems = (userEmail) => {
    try {
      const db = getFirestore(app);
      const sharedQuery = query(
        collection(db, 'items'),
        where('sharedWith', 'array-contains', userEmail)
      );
      const unsubscribe = onSnapshot(sharedQuery, (querySnapshot) => {
        if (querySnapshot) {
          const sharedItemsList = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSharedItems(sharedItemsList);
          setLoadingShared(false);
        } else {
          setLoadingShared(false);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching shared items: ', error);
      setLoadingShared(false);
      return () => {};
    }
  };

  const removeSharedWithEmail = async (itemId) => {
    try {
      const db = getFirestore(app);
      const itemDocRef = doc(db, 'items', itemId);
      const docSnap = await getDoc(itemDocRef);
  
      // Alert if the document does not exist
      if (!docSnap.exists) {
        Alert.alert("Error", "Document not found");
        console.error("Document not found");
        return;
      }
  
      const data = docSnap.data();
      const userEmail = user?.email;
  
      // Alert if the user email is not available
      if (!userEmail) {
        Alert.alert("Error", "User email not available");
        console.error("User email not available");
        return;
      }
  
      const scheduledBy = data.scheduledBy || [];
      const inUseBy = data.inUseBy || [];
  
      // Block removal if the email is in scheduledBy or inUseBy
      if (scheduledBy.includes(userEmail) || inUseBy.includes(userEmail)) {
        Alert.alert(
          "Cannot Remove",
          "You have scheduled or are currently using this item."
        );
        return;
      }
  
      // Confirmation alert before removing the email and the item from favorites,
      // including the item name in the message.
      Alert.alert(
        "Confirm Removal",
        `Are you sure you want to lose access to ${data.name}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "OK",
            onPress: async () => {
              try {
                // Remove the user's email from the item's sharedWith array
                await updateDoc(itemDocRef, {
                  sharedWith: arrayRemove(userEmail),
                });
  
                // Remove the itemId from the current user's favorites array
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                  favorites: arrayRemove(itemId),
                });

              } catch (error) {
                Alert.alert("Error", "Error removing shared email or updating favorites");
                console.error("Error removing shared email or updating favorites:", error);
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      Alert.alert("Error", "Error removing shared email");
      console.error("Error removing shared email:", error);
    }
  };    

  const handleAddPress = () => {
    router.push('/(add)');
  };

  const handleItemPress = async (itemId) => {
    if (welcome6ModalVisible) {
      setWelcome6ModalVisible(false);
      const db = getFirestore();
      const userDocRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userDocRef, { welcome6: false });
      } catch (error) {
        console.error("Error updating the welcome field:", error);
      }
    }
    router.push({
      pathname: '/(inspect)',
      params: { itemId },
    });
  };

  const handleWelcome3Close = async () => {
    setWelcome3ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome3: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleWelcome5Close = async () => {
    setWelcome5ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome5: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleWelcome6Close = async () => {
    setWelcome6ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome6: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleNoFriendsVisibleClose = async () => {
    setNoFriendsVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { noFriendsVisible: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  return (
    <View style={styles.container}>
      {loadingCreated || loadingShared ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalStyles.mainBackgroundColor.color}}>
          <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
        </View>
      ) : (
        <ScrollView
          style={[
            styles.container1,
            { backgroundColor: globalStyles.mainBackgroundColor.color },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { marginTop: 5, color: globalStyles.BlackOrwhite.color }]}>Created by you</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.section}>
              <View style={styles.listContainer}>
                {loadingCreated ? (
                  <View style={styles.loadingContainer}>
                  </View>
                ) : items.length === 0 ? (
                  <Text style={styles.emptyMessage}>No items created by you</Text>
                ) : (
                  [...items]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.5}
                        style={[
                          styles.item,
                          { backgroundColor: item.availability ? globalStyles.notOccupiedColor.color : globalStyles.occupiedColor.color },
                        ]}
                        onPress={() => handleItemPress(item.id)}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[
                            styles.itemText,
                            { color: item.availability ? globalStyles.BlackOrwhite.color : '#e3e7f3', marginTop: 23 },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[
                            styles.statusText,
                            { color: item.availability ? globalStyles.BlackOrwhite.color : '#e3e7f3', marginBottom: 23 },
                          ]}
                        >
                          {item.availability ? 'Available' : 'Unavailable'}
                        </Text>
                      </TouchableOpacity>
                    ))
                )}
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, {color: globalStyles.BlackOrwhite.color}]}>Shared with you</Text>
          <View style={{ flex: 1, marginBottom: 15, marginTop: 5 }}>
            {loadingShared ? (
              <View style={styles.loadingContainer}>
              </View>
            ) : sharedItems.length === 0 ? (
              <Text style={styles.emptyMessage}>No items shared with you</Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[...sharedItems]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.5}
                      style={[
                        styles.item,
                        {
                          backgroundColor: item.availability ? globalStyles.notOccupiedColor.color : globalStyles.occupiedColor.color,
                          position: 'relative',
                        },
                      ]}
                      onPress={() => handleItemPress(item.id)}
                    >
                      <Text
                        style={[
                          styles.itemText,
                          { color: item.availability ? globalStyles.BlackOrwhite.color : '#e3e7f3', marginTop: 23 },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode='tail'
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.statusText,
                          { color: item.availability ? globalStyles.BlackOrwhite.color : '#e3e7f3', marginBottom: 23 },
                        ]}
                      >
                        {item.availability ? 'Available' : 'Unavailable'}
                      </Text>
                      {showDelete && (
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            backgroundColor: 'transparent',
                            width: '100%',
                            height: '100%',
                            borderRadius: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0.5,
                          }}
                          onPress={() => removeSharedWithEmail(item.id)}
                        >
                          <MaterialIcons name="close" size={70} color="red" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))
                }
                </View>
              </>
            )}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 100,
              width: '100%',
            }}
          >
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: 'transparent',
                  flex: 1,
                  marginRight: 5,
                  borderWidth: 1,
                  borderColor: 'grey',
                  paddingVertical: 10,
                  alignItems: 'center',
                },
              ]}
              onPress={() => {
                setSearchModalVisible(true);
                setSearchQuery('');
                setFilteredResults([]);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons
                  name="search"
                  size={20}
                  color={globalStyles.mainColorOnly.color}
                />
                <Text style={[styles.buttonText, { color: globalStyles.mainColorOnly.color }]}>
                  Search
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: showDelete ? 'red' : 'transparent',
                  flex: 1,
                  marginLeft: 5,
                  borderWidth: 1,
                  borderColor: 'grey',
                  paddingVertical: 10,
                  alignItems: 'center',
                },
              ]}

              onPress={toggleDelete}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons
                  name="delete"
                  size={20}
                  color={showDelete ? globalStyles.mainBackgroundColor : globalStyles.mainColorOnly.color}
                />
                <Text style={[styles.buttonText, { color: showDelete ? globalStyles.mainBackgroundColor : globalStyles.mainColorOnly.color }]}>
                  Remove
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {welcome5ModalVisible && !firstItemYet && (
        <View style={{position: 'absolute', left: 20, width: '70%', top: 20}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>This is the manage page</Text>
            <Text style={{color: 'white', fontSize: 15, marginTop: 10}}>Here, you can view and access everything you have added to the app, or, anything anyone has shared with you</Text>
            <TouchableOpacity
              onPress={handleWelcome5Close}
              style={styles.closeButton2}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '25%'}]} />
        </View>
      )}
      {firstItemYet && welcome6ModalVisible && (
        <View style={{position: 'absolute', left: 20, width: 270, top: 150}}>
          <View style={[styles.triangleUp, {borderBottomColor: globalStyles.mainColor.color, marginLeft: '25%'}]} />
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Tap items to view</Text>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 15}}>Share this item with added friends and start scheduling!</Text>
            <TouchableOpacity
              onPress={handleWelcome6Close}
              style={styles.closeButton2}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {noFriendsVisible && noFriends && (
        <View style={{position: 'absolute', left: '20%', width: 200, bottom: 0, zIndex: 100}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Add friends here!</Text>
            <TouchableOpacity
              onPress={handleNoFriendsVisibleClose}
              style={styles.closeButton2}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '73%'}]} />
        </View>
      )}
      {welcome3ModalVisible && !firstItemYet && (
        <View style={{position: 'absolute', left: '25%', width: '70%', bottom: 90}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Press 'New' button to add your first item</Text>
            <TouchableOpacity
              onPress={handleWelcome3Close}
              style={styles.closeButton2}
            >
              <MaterialIcons
                name="close"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '75%'}]} />
        </View>
      )}
      <TouchableOpacity style={[styles.floatingButton, {backgroundColor: globalStyles.brightMainColor.color}]} onPress={handleAddPress}>
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.buttonText}>New</Text>
      </TouchableOpacity>
      
      <Modal
        animationType="fade"
        transparent={true}
        visible={searchModalVisible}
        onRequestClose={() => setSearchModalVisible(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, {backgroundColor: globalStyles.mainBackgroundColor.color}]}>
            <Text style={{fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Search</Text>
            <Text style={{color: globalStyles.DarkGreyOrLightGrey.color, marginTop: 5}}>Search through all of your items by name</Text>
            <Text style={{color: globalStyles.DarkGreyOrLightGrey.color, marginBottom: 30}}>Tap it's name below to inspect</Text>
            <TextInput
              style={[styles.searchInput, {color: globalStyles.BlackOrwhite.color, fontSize: 15}]}
              placeholder="Search..."
              placeholderTextColor={globalStyles.DarkGreyOrLightGrey.color}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => setSearchModalVisible(false)}
              style={styles.closeButton}
            >
              <MaterialIcons
                name="close"
                size={28}
                color={globalStyles.BlackOrwhite.color}
              />
            </TouchableOpacity>
            <ScrollView horizontal={true} style={{ maxHeight: '60%' , marginTop: 10}} showsHorizontalScrollIndicator={false}>
              {filteredResults.length > 0 ? (
                filteredResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setSearchModalVisible(false);
                      handleItemPress(item.id);
                    }}
                    style={{ marginRight: 10, backgroundColor: globalStyles.LightGreyOrDarkGrey.color, borderRadius: 10, padding: 0 }}
                  >
                    <Text style={[styles.modalItem, {marginHorizontal: 10, color: globalStyles.BlackOrwhite.color}]}>{item.name}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.modalItem, {color: globalStyles.BlackOrwhite.color}]}>No matching items</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  triangleUp: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
  },
  searchInput: {
    height: 50,
    borderColor: 'grey',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
  },
  closeButton2: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeButtonText: {
    color: '#4CAF50',
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  modalItem: {
    fontSize: 14,
    paddingVertical: 5,
  },
  button: {  
    borderRadius: 50,        
    paddingVertical: 10,      
    alignItems: 'center',     
    justifyContent: 'center', 
    marginBottom: 10,
  },
  scrollview: {
    flex: 1,
  },
  container1: {
    flex: 1,
    flexDirection: 'column',
    padding: 15,
  },
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 20,
    marginTop: 5,
    flex: 1,
  },
  listContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    width: '48%',
    margin: '1%',
    borderRadius: 29,
    position: 'relative',
  },
  statusText: {
    fontSize: 13,
    textAlign: 'center',
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: 100,
    height: 60,
    right: 20,
    bottom: 20,
    elevation: 5,
    borderRadius: 30,
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    marginLeft: 5,
  },
  itemText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 5,
    marginHorizontal: 20,
    fontWeight: 500
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessage: {
    fontSize: 13,
    color: '#7d7d7d',
    marginTop: 50,
    marginBottom: 50,
    textAlign: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'left',
    marginLeft: 15,
    fontWeight: '500',
  },
});
